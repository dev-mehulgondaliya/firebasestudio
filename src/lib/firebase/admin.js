import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { DocumentReference, FieldValue, GeoPoint, getFirestore, Timestamp } from "firebase-admin/firestore";
import { createFirestoreCodec } from "@/lib/firestore/codec";

// Firebase Admin instances for user connections, used only by the Database
// Explorer API routes (fixed CRUD operations, never arbitrary code). Arbitrary
// scripts run in the separate execution worker, see lib/execution/server-runner.js.

const cache = (globalThis.__studioAdminApps ??= new Map());

function appName(connectionId) {
  return `studio-conn-${connectionId}`;
}

/** Returns a Firestore instance for a connection, recreating it if the connection changed. */
export async function getConnectionFirestore(connection, serviceAccount) {
  const name = appName(connection.id);
  const version = connection.updatedAt;
  const cached = cache.get(name);
  if (cached && cached.version === version) return cached.db;

  const existing = getApps().find((app) => app.name === name);
  if (existing) await deleteApp(existing).catch(() => {});

  const app = initializeApp(
    { credential: cert(serviceAccount), projectId: serviceAccount.project_id },
    name,
  );
  const db = getFirestore(app);
  cache.set(name, { version, db });
  return db;
}

export async function disposeConnectionApp(connectionId) {
  const name = appName(connectionId);
  cache.delete(name);
  const existing = getApps().find((app) => app.name === name);
  if (existing) await deleteApp(existing).catch(() => {});
}

export function createAdminCodec(db) {
  return createFirestoreCodec({
    isTimestamp: (value) => value instanceof Timestamp,
    timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds),
    isGeoPoint: (value) => value instanceof GeoPoint,
    geoPoint: (latitude, longitude) => new GeoPoint(latitude, longitude),
    isReference: (value) => value instanceof DocumentReference,
    reference: (path) => db.doc(path),
    isBytes: (value) => value instanceof Uint8Array,
    bytesToBase64: (value) => Buffer.from(value).toString("base64"),
    bytesFromBase64: (base64) => Buffer.from(base64, "base64"),
    isVector: (value) => value?.constructor?.name === "VectorValue" && typeof value.toArray === "function",
    vectorToArray: (value) => value.toArray(),
    vector: (values) => FieldValue.vector(values),
  });
}

/** Serialises an Admin DocumentSnapshot for the API. */
export function serializeSnapshot(snapshot, codec) {
  return {
    id: snapshot.id,
    path: snapshot.ref.path,
    exists: snapshot.exists,
    data: snapshot.exists ? codec.encodeDocument(snapshot.data()) : null,
    createTime: snapshot.createTime?.toDate().toISOString() ?? null,
    updateTime: snapshot.updateTime?.toDate().toISOString() ?? null,
  };
}
