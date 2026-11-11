"use client";

import { deleteApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  Bytes,
  doc,
  DocumentReference,
  GeoPoint,
  getFirestore,
  Timestamp,
  vector,
  VectorValue,
} from "firebase/firestore";
import { createFirestoreCodec } from "@/lib/firestore/codec";

// Firebase Web SDK instances for "web config" connections, used by the
// Database Explorer. Each connection gets its own named app so several
// projects can be open in one tab. Security Rules apply to every request.

function appName(connection) {
  return `studio-web-${connection.id}`;
}

export function getWebApp(connection) {
  const name = appName(connection);
  const existing = getApps().find((app) => app.name === name);
  if (existing) {
    if (existing.__studioVersion === connection.updatedAt) return existing;
    deleteApp(existing).catch(() => {});
  }
  const app = initializeApp(connection.webConfig, name);
  app.__studioVersion = connection.updatedAt;
  return app;
}

export function getWebFirestore(connection) {
  return getFirestore(getWebApp(connection));
}

export function createWebCodec(db) {
  return createFirestoreCodec({
    isTimestamp: (value) => value instanceof Timestamp,
    timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds),
    isGeoPoint: (value) => value instanceof GeoPoint,
    geoPoint: (latitude, longitude) => new GeoPoint(latitude, longitude),
    isReference: (value) => value instanceof DocumentReference,
    reference: (path) => doc(db, path),
    isBytes: (value) => value instanceof Bytes,
    bytesToBase64: (value) => value.toBase64(),
    bytesFromBase64: (base64) => Bytes.fromBase64String(base64),
    isVector: (value) => value instanceof VectorValue,
    vectorToArray: (value) => value.toArray(),
    vector: (values) => vector(values),
  });
}

function describeUser(user) {
  if (!user) return null;
  return { uid: user.uid, email: user.email || null, displayName: user.displayName || null, isAnonymous: user.isAnonymous };
}

/** Auth controller for the Explorer (main page, persisted by the Web SDK). */
export function createWebAuthController(connection) {
  const auth = getAuth(getWebApp(connection));
  return {
    subscribe: (callback) => onAuthStateChanged(auth, (user) => callback(describeUser(user))),
    signInAnonymously: () => signInAnonymously(auth).then((cred) => describeUser(cred.user)),
    signInWithPassword: (email, password) => signInWithEmailAndPassword(auth, email, password).then((cred) => describeUser(cred.user)),
    signOut: () => signOut(auth),
  };
}

/** Auth controller backed by the Playground sandbox (in-memory, per tab). */
export function createSandboxAuthController(sandbox, subscribeToState) {
  return {
    subscribe: subscribeToState,
    signInAnonymously: () => sandbox.auth("anonymous"),
    signInWithPassword: (email, password) => sandbox.auth("password", { email, password }),
    signOut: () => sandbox.auth("signOut"),
  };
}

/** Accepts JSON or the JS snippet from the Firebase console and returns a plain object. */
export function parseWebConfigInput(text) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Paste your Firebase config.");
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Could not find a { ... } config object.");
  const body = source.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    // Convert a JS object literal into JSON: quote keys, single → double quotes,
    // strip comments and trailing commas.
    const json = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'])\/\/.*$/gm, "$1")
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => JSON.stringify(inner.replace(/\\'/g, "'")))
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(json);
    } catch {
      throw new Error("The config is not valid JSON or a simple JavaScript object literal.");
    }
  }
}
