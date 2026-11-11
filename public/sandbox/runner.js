/*
 * Firebase Studio – browser sandbox host (runs inside the sandboxed iframe).
 *
 * Relays messages between Studio (window.parent) and a Web Worker that owns
 * the Firebase Web SDK instance and executes user scripts. Enforces the
 * execution timeout by terminating the worker, which also stops synchronous
 * infinite loops.
 *
 * Studio → sandbox: { __studioHost: true, type: "init" | "run" | "auth" | "cancel", ... }
 * sandbox → Studio: { __studioSandbox: true, type: "loaded" | "ready" | "init-error" |
 *                     "log" | "done" | "auth-state" | "auth-result" | "reset", ... }
 */
(function () {
  "use strict";

  var host = window.parent;
  var SERIALIZER_URL = new URL("./serializer.js", location.href).href;
  var WORKER_URL = new URL("./worker.js", location.href).href;

  var worker = null;
  var config = null;
  var current = null; // { runId, timer, started }

  function post(message) {
    message.__studioSandbox = true;
    // The parent's origin is not visible from an opaque origin; Studio verifies
    // event.source on its side.
    host.postMessage(message, "*");
  }

  function createWorker() {
    // Workers must be same-origin with their creator; a blob URL satisfies that
    // for this opaque origin, and importScripts may load the real code.
    var source = "importScripts(" + JSON.stringify(SERIALIZER_URL) + ", " + JSON.stringify(WORKER_URL) + ");";
    var url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    worker = new Worker(url);
    worker.onmessage = function (event) {
      handleWorkerMessage(event.data);
    };
    worker.onerror = function (event) {
      event.preventDefault();
      post({ type: "init-error", error: { name: "SandboxError", message: event.message || "Sandbox worker failed to start." } });
    };
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 10000);
    if (config) worker.postMessage({ type: "init", config: config });
  }

  function resetWorker(reason) {
    if (worker) worker.terminate();
    worker = null;
    createWorker();
    post({ type: "reset", reason: reason });
  }

  function finishCurrent(message) {
    if (!current) return;
    clearTimeout(current.timer);
    current = null;
    post(message);
  }

  function startRun(message) {
    if (current) {
      post({ type: "done", runId: message.runId, status: "error", error: { name: "Busy", message: "Another script is still running." }, durationMs: 0 });
      return;
    }
    var timeoutMs = Math.max(1000, Math.min(Number(message.timeoutMs) || 30000, 300000));
    current = {
      runId: message.runId,
      started: Date.now(),
      timer: setTimeout(function () {
        var run = current;
        current = null;
        resetWorker("timeout");
        post({
          type: "done",
          runId: run.runId,
          status: "timeout",
          error: { name: "TimeoutError", message: "Script exceeded the " + Math.round(timeoutMs / 1000) + "s time limit and was terminated." },
          durationMs: Date.now() - run.started,
        });
      }, timeoutMs),
    };
    worker.postMessage({ type: "run", runId: message.runId, code: String(message.code || "") });
  }

  function handleWorkerMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "done") {
      if (current && current.runId === message.runId) finishCurrent(message);
      return;
    }
    if (message.type === "log" && (!current || current.runId !== message.runId)) return;
    post(message);
  }

  window.addEventListener("message", function (event) {
    if (event.source !== host) return;
    var message = event.data;
    if (!message || message.__studioHost !== true) return;

    switch (message.type) {
      case "init":
        config = message.config;
        if (worker) worker.terminate();
        current = null;
        createWorker();
        break;
      case "run":
        startRun(message);
        break;
      case "auth":
        if (worker) worker.postMessage(message);
        break;
      case "cancel":
        if (current) {
          var run = current;
          clearTimeout(run.timer);
          current = null;
          resetWorker("cancelled");
          post({ type: "done", runId: run.runId, status: "error", error: { name: "Cancelled", message: "Execution was stopped." }, durationMs: Date.now() - run.started });
        }
        break;
      default:
        break;
    }
  });

  post({ type: "loaded" });
})();
