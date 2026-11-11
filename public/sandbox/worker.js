/*
 * Firebase Studio – browser sandbox worker.
 *
 * Owns the Firebase Web SDK (compat build, so scripts can use the familiar
 * db.collection("x").get() API) and runs user scripts. All Firestore access
 * goes through the Web SDK, so the project's Security Rules apply.
 *
 * Globals available to scripts: db, auth, firebase, app, console.
 * `StudioSerializer` is loaded before this file (see runner.js).
 */
/* global StudioSerializer, firebase */
"use strict";

// new AsyncFunction(...) places the body two lines below the generated header.
var LINE_OFFSET = 2;
var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

var app = null;
var db = null;
var auth = null;
var currentRunId = null;

function post(message) {
  self.postMessage(message);
}

// The Firebase SDK reports problems such as "Could not reach Cloud Firestore
// backend" through the global console. Show those in the current run's output
// (scripts themselves log through the console object passed to them).
["warn", "error"].forEach(function (level) {
  var original = console[level].bind(console);
  console[level] = function () {
    original.apply(null, arguments);
    if (!currentRunId) return;
    post({
      type: "log",
      runId: currentRunId,
      entry: { level: "warn", args: StudioSerializer.serializeArgs(Array.prototype.slice.call(arguments)), ts: Date.now(), source: "firebase" },
    });
  };
});

function describeUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    isAnonymous: Boolean(user.isAnonymous),
  };
}

function init(config) {
  try {
    if (!/^\d+\.\d+\.\d+$/.test(config.sdkVersion || "")) throw new Error("Invalid Firebase SDK version.");
    var base = "https://www.gstatic.com/firebasejs/" + config.sdkVersion + "/";
    importScripts(base + "firebase-app-compat.js", base + "firebase-auth-compat.js", base + "firebase-firestore-compat.js");

    app = firebase.initializeApp(config.webConfig);
    auth = firebase.auth();
    // This worker has an opaque origin (no IndexedDB/localStorage): keep auth in memory.
    auth.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(function () {});
    db = firebase.firestore();
    if (config.firestoreSettings) db.settings(config.firestoreSettings);

    auth.onAuthStateChanged(function (user) {
      post({ type: "auth-state", user: describeUser(user) });
    });
    post({ type: "ready", sdkVersion: config.sdkVersion, projectId: config.webConfig.projectId });
  } catch (error) {
    post({ type: "init-error", error: StudioSerializer.serializeError(error) });
  }
}

async function run(message) {
  var runId = message.runId;
  var started = Date.now();
  currentRunId = runId;

  function emit(entry) {
    post({ type: "log", runId: runId, entry: entry });
  }

  function done(payload) {
    if (currentRunId === runId) currentRunId = null;
    payload.type = "done";
    payload.runId = runId;
    payload.durationMs = Date.now() - started;
    post(payload);
  }

  if (!db) {
    done({ status: "error", error: { name: "SandboxError", message: "Firebase is not initialised in the sandbox." } });
    return;
  }

  var script;
  try {
    script = new AsyncFunction("db", "auth", "firebase", "app", "console", message.code);
  } catch (error) {
    done({ status: "error", error: StudioSerializer.serializeError(error) });
    return;
  }

  try {
    var result = await script(db, auth, firebase, app, StudioSerializer.createConsole(emit, LINE_OFFSET));
    done({ status: "success", result: result === undefined ? undefined : StudioSerializer.serialize(result) });
  } catch (error) {
    done({ status: "error", error: StudioSerializer.serializeError(error, LINE_OFFSET) });
  }
}

async function handleAuth(message) {
  try {
    if (!auth) throw new Error("Firebase is not initialised in the sandbox.");
    if (message.action === "anonymous") await auth.signInAnonymously();
    else if (message.action === "password") await auth.signInWithEmailAndPassword(message.email, message.password);
    else if (message.action === "signOut") await auth.signOut();
    else throw new Error("Unknown auth action.");
    post({ type: "auth-result", requestId: message.requestId, ok: true, user: describeUser(auth.currentUser) });
  } catch (error) {
    post({
      type: "auth-result",
      requestId: message.requestId,
      ok: false,
      error: { code: error && error.code, message: (error && error.message) || String(error) },
    });
  }
}

self.addEventListener("unhandledrejection", function (event) {
  if (!currentRunId) return;
  post({
    type: "log",
    runId: currentRunId,
    entry: { level: "error", args: StudioSerializer.serializeArgs(["Unhandled promise rejection:", event.reason]), ts: Date.now() },
  });
});

self.onmessage = function (event) {
  var message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "init") init(message.config);
  else if (message.type === "run") run(message);
  else if (message.type === "auth") handleAuth(message);
};
