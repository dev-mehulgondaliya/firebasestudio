"use strict";

/*
 * Firebase Studio – Node.js execution worker.
 *
 * Runs ONE user script against ONE Firebase project, then exits. It is started
 * by src/lib/execution/server-runner.js as a separate, permission-restricted
 * process. This process boundary (not eval/vm) is the isolation layer.
 *
 * Protocol (IPC, JSON serialization):
 *   parent → worker  { type: "run", code, serviceAccount, projectId, env }
 *   worker → parent  { type: "log", entry }               (0..n times)
 *   worker → parent  { type: "done", status, result?, error?, durationMs, droppedLogs }
 *
 * Globals available to scripts: db, admin, console, process (env only), Buffer.
 */

const path = require("node:path");
const serializer = require(path.join(__dirname, "..", "..", "public", "sandbox", "serializer.js"));

// new AsyncFunction(...) puts the body two lines below the header.
const LINE_OFFSET = 2;
const MAX_LOG_ENTRIES = 1000;

let logCount = 0;
let droppedLogs = 0;
let finished = false;
let started = Date.now();

function emitLog(entry) {
  if (logCount >= MAX_LOG_ENTRIES) {
    droppedLogs += 1;
    return;
  }
  logCount += 1;
  if (process.connected) process.send({ type: "log", entry });
}

const scriptConsole = serializer.createConsole(emitLog, LINE_OFFSET);

// Libraries (firebase-admin, google-auth) log through the global console.
// Forward that as low-priority "sdk" output instead of raw stderr, and drop
// notices about Studio's own SDK usage that users cannot act on.
const IGNORED_SDK_NOTICES = [/The `credentials` option is deprecated/];
for (const level of ["log", "info", "warn", "error", "debug"]) {
  console[level] = (...args) => {
    const text = args.map(String).join(" ");
    if (IGNORED_SDK_NOTICES.some((pattern) => pattern.test(text))) return;
    emitLog({ level: level === "error" ? "warn" : level, args: serializer.serializeArgs(args), ts: Date.now(), source: "sdk" });
  };
}

function finish(payload) {
  if (finished) return;
  finished = true;
  const message = { type: "done", durationMs: Date.now() - started, droppedLogs, ...payload };
  if (!process.connected) process.exit(0);
  process.send(message, () => process.exit(0));
}

process.on("unhandledRejection", (reason) => {
  emitLog({ level: "error", args: serializer.serializeArgs(["Unhandled promise rejection:", reason]), ts: Date.now() });
});

process.on("uncaughtException", (error) => {
  if (finished) return;
  finish({ status: "error", error: serializer.serializeError(error, LINE_OFFSET) });
});

function buildAdminNamespace(app, db) {
  const firestoreModule = require("firebase-admin/firestore");
  // firebase-admin v12+ removed the namespaced API. Recreate the familiar
  // shape so admin.firestore.FieldValue / admin.auth() keep working.
  const firestore = Object.assign(() => db, firestoreModule);
  return Object.freeze({
    app,
    firestore,
    auth: () => require("firebase-admin/auth").getAuth(app),
    FieldValue: firestoreModule.FieldValue,
    FieldPath: firestoreModule.FieldPath,
    Timestamp: firestoreModule.Timestamp,
    GeoPoint: firestoreModule.GeoPoint,
  });
}

async function run(job) {
  started = Date.now();
  const { initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");

  const app = initializeApp({ credential: cert(job.serviceAccount), projectId: job.projectId });
  job.serviceAccount = null;
  const db = getFirestore(app);
  const admin = buildAdminNamespace(app, db);

  const scriptProcess = Object.freeze({
    env: Object.freeze({ ...(job.env || {}) }),
    version: process.version,
    platform: process.platform,
    hrtime: process.hrtime,
    nextTick: process.nextTick,
    memoryUsage: () => process.memoryUsage(),
  });

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  let script;
  try {
    script = new AsyncFunction(
      "db",
      "admin",
      "console",
      "process",
      "Buffer",
      "require",
      "module",
      "exports",
      "__filename",
      "__dirname",
      job.code,
    );
  } catch (error) {
    // Syntax errors: V8 does not give a line for Function-constructor bodies,
    // so report the message as-is.
    finish({ status: "error", error: serializer.serializeError(error) });
    return;
  }

  try {
    const result = await script(db, admin, scriptConsole, scriptProcess, Buffer);
    finish({ status: "success", result: result === undefined ? undefined : serializer.serialize(result) });
  } catch (error) {
    finish({ status: "error", error: serializer.serializeError(error, LINE_OFFSET) });
  }
}

process.once("message", (job) => {
  if (!job || job.type !== "run" || typeof job.code !== "string") {
    finish({ status: "error", error: { $type: "error", name: "ProtocolError", message: "Invalid job." } });
    return;
  }
  run(job).catch((error) => finish({ status: "error", error: serializer.serializeError(error, LINE_OFFSET) }));
});

// The parent enforces the real timeout; this guards against a lost parent.
process.on("disconnect", () => process.exit(0));
