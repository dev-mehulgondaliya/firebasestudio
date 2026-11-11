import { spawn } from "node:child_process";
import path from "node:path";

// Runs an Admin SDK script in a *separate* Node.js process. User code never
// executes inside the Next.js server process.
//
// Isolation applied to every run:
//  - fresh process per execution, killed when the run ends or times out
//  - Node.js permission model: read-only access to the worker and node_modules,
//    no file writes, no child processes, no worker threads, no native addons
//  - heap limit (--max-old-space-size) and a hard wall-clock timeout
//  - empty environment: only variables listed in EXECUTION_ENV_ALLOWLIST
//  - credentials for exactly one connection, delivered over the IPC channel
//    (never argv or env) and discarded with the process
//
// Production deployments should move this behind an ephemeral container
// service (e.g. Cloud Run jobs) with network egress restrictions; the worker
// protocol (one JSON job in, log/done messages out) is designed for that.

const ROOT = process.cwd();
const WORKER_DIR = path.join(ROOT, "workers", "execution-worker");
const WORKER_ENTRY = path.join(WORKER_DIR, "index.js");
const SERIALIZER_DIR = path.join(ROOT, "public", "sandbox");

const MEMORY_LIMIT_MB = 256;
const MAX_LOG_ENTRIES = 1000;
const MAX_LOG_BYTES = 1024 * 1024;
const MAX_QUEUE = 10;

const state = (globalThis.__studioRunner ??= { active: 0, waiting: [] });

function maxConcurrency() {
  const value = Number(process.env.EXECUTION_MAX_CONCURRENCY);
  return Number.isInteger(value) && value > 0 ? value : 3;
}

async function acquireSlot() {
  if (state.active < maxConcurrency()) {
    state.active += 1;
    return;
  }
  if (state.waiting.length >= MAX_QUEUE) {
    const error = new Error("The execution queue is full. Try again shortly.");
    error.status = 429;
    throw error;
  }
  await new Promise((resolve) => state.waiting.push(resolve));
}

function releaseSlot() {
  const next = state.waiting.shift();
  if (next) next();
  else state.active = Math.max(0, state.active - 1);
}

export function permissionModelAvailable() {
  return process.allowedNodeEnvironmentFlags.has("--permission");
}

function nodeArgs() {
  const args = [`--max-old-space-size=${MEMORY_LIMIT_MB}`, "--disable-proto=delete", "--no-deprecation"];
  if (permissionModelAvailable()) {
    const dir = (p) => (p.endsWith(path.sep) ? p : p + path.sep);
    args.push(
      "--permission",
      `--allow-fs-read=${dir(WORKER_DIR)}`,
      `--allow-fs-read=${dir(SERIALIZER_DIR)}`,
      `--allow-fs-read=${dir(path.join(ROOT, "node_modules"))}`,
    );
  }
  return args;
}

/** Only allow-listed variables reach the worker; everything else (secrets!) stays behind. */
export function scriptEnv() {
  const names = (process.env.EXECUTION_ENV_ALLOWLIST || "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && !name.startsWith("STUDIO_"));
  return Object.fromEntries(names.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
}

// The worker *process* environment. Scripts never see it directly: their
// `process.env` is the allow-listed object from scriptEnv(). (On Windows,
// libuv also injects basics such as PATH and USERNAME; none are secrets.)
function processEnv() {
  const env = { NODE_ENV: "production" };
  if (process.platform === "win32") {
    // Required by Windows networking/crypto APIs; contains no secrets.
    for (const key of ["SystemRoot", "SYSTEMROOT", "windir", "TEMP", "TMP"]) {
      if (process.env[key]) env[key] = process.env[key];
    }
  }
  return env;
}

/**
 * @returns {Promise<{status:"success"|"error"|"timeout", logs:object[], result?:any, error?:object, durationMs:number, logsTruncated:boolean}>}
 */
export async function runServerScript({ code, serviceAccount, projectId, timeoutMs }) {
  await acquireSlot();
  try {
    return await spawnJob({ code, serviceAccount, projectId, timeoutMs });
  } finally {
    releaseSlot();
  }
}

function spawnJob({ code, serviceAccount, projectId, timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const logs = [];
    let logBytes = 0;
    let logsTruncated = false;
    let settled = false;
    let stderrText = "";

    const child = spawn(process.execPath, [...nodeArgs(), WORKER_ENTRY], {
      cwd: WORKER_DIR,
      env: processEnv(),
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
      serialization: "json",
    });

    function pushLog(entry) {
      if (logs.length >= MAX_LOG_ENTRIES) {
        logsTruncated = true;
        return;
      }
      const size = JSON.stringify(entry).length;
      if (logBytes + size > MAX_LOG_BYTES) {
        logsTruncated = true;
        return;
      }
      logBytes += size;
      logs.push(entry);
    }

    function finish(outcome) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      resolve({
        status: outcome.status,
        result: outcome.result,
        error: outcome.error ?? null,
        logs,
        logsTruncated: logsTruncated || Boolean(outcome.droppedLogs),
        durationMs: outcome.durationMs ?? Date.now() - started,
      });
    }

    const timer = setTimeout(() => {
      finish({
        status: "timeout",
        error: { name: "TimeoutError", message: `Script exceeded the ${Math.round(timeoutMs / 1000)}s time limit and was terminated.` },
      });
    }, timeoutMs);

    child.on("message", (message) => {
      if (message?.type === "log" && message.entry) pushLog(message.entry);
      else if (message?.type === "done") finish(message);
    });

    const capture = (level) => (chunk) => {
      const text = chunk.toString("utf8");
      if (level === "error") {
        if (stderrText.length < 4000) stderrText += text.slice(0, 4000 - stderrText.length);
        // V8's fatal OOM report is a long native stack dump; keep it out of the console.
        if (/heap limit|out of memory|^\s*\d+: [0-9A-F]{8,}/im.test(stderrText) && /FATAL ERROR/.test(stderrText)) return;
      }
      pushLog({ level, args: [text.replace(/\n$/, "")], ts: Date.now(), source: level === "error" ? "stderr" : "stdout" });
    };
    child.stdout.on("data", capture("log"));
    child.stderr.on("data", capture("error"));

    child.on("error", (error) => {
      finish({ status: "error", error: { name: "WorkerError", message: `Could not start the execution worker: ${error.message}` } });
    });

    child.on("exit", (code, signal) => {
      if (settled) return;
      const outOfMemory = /heap limit|out of memory/i.test(stderrText);
      finish({
        status: "error",
        error: {
          name: outOfMemory ? "OutOfMemoryError" : "WorkerExit",
          message: outOfMemory
            ? `Script exceeded the ${MEMORY_LIMIT_MB} MB memory limit.`
            : `Execution worker stopped unexpectedly (${signal ? `signal ${signal}` : `exit code ${code}`}).`,
        },
      });
    });

    child.send({ type: "run", code, serviceAccount, projectId, env: scriptEnv() }, (error) => {
      if (error) finish({ status: "error", error: { name: "WorkerError", message: `Could not send job to worker: ${error.message}` } });
    });
  });
}
