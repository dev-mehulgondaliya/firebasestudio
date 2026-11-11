import crypto from "node:crypto";
import { HttpError } from "@/lib/api/errors";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { assertOwner } from "@/lib/security/permissions";
import {
  audit,
  deleteConnectionRecord,
  getConnectionRecord,
  insertConnectionRecord,
  listConnectionRecords,
  toPublicConnection,
  updateConnectionRecord,
} from "@/lib/studio-db";
import { createAdminCodec, disposeConnectionApp, getConnectionFirestore } from "@/lib/firebase/admin";

// Server-side owner of connection records. Service-account JSON only exists
// in plaintext inside this module's callers for the duration of a request.

export async function listConnections(user) {
  return (await listConnectionRecords(user.uid)).map(toPublicConnection);
}

export async function getConnection(user, id) {
  return assertOwner(await getConnectionRecord(id), user, "Connection");
}

export async function createConnection(user, input) {
  const id = crypto.randomUUID();
  let record;

  if (input.connectionType === "web") {
    record = {
      userId: user.uid,
      name: input.name,
      connectionType: "web",
      projectId: input.webConfig.projectId,
      webConfig: input.webConfig,
    };
  } else {
    const serviceAccount = input.serviceAccount;
    try {
      crypto.createPrivateKey(serviceAccount.private_key);
    } catch {
      throw new HttpError(400, "serviceAccount.private_key is not a valid PEM private key.");
    }
    record = {
      userId: user.uid,
      name: input.name,
      connectionType: "admin",
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      encryptedCredentials: encryptSecret(JSON.stringify(serviceAccount), { userId: user.uid, connectionId: id }),
    };
  }

  const saved = await insertConnectionRecord(id, record);
  await audit(user.uid, { connectionId: id, operation: "connection.create", resource: `${record.connectionType}:${record.projectId}` });
  return toPublicConnection(saved);
}

export async function renameConnection(user, id, name) {
  await getConnection(user, id);
  return toPublicConnection(await updateConnectionRecord(id, { name }));
}

export async function removeConnection(user, id) {
  const connection = await getConnection(user, id);
  await disposeConnectionApp(id);
  await deleteConnectionRecord(id);
  await audit(user.uid, { connectionId: id, operation: "connection.delete", resource: `${connection.connectionType}:${connection.projectId}` });
}

/** Decrypts the service account of an Admin connection. Never return this to a client. */
export function readServiceAccount(connection) {
  if (connection.connectionType !== "admin" || !connection.encryptedCredentials) {
    throw new HttpError(400, "This connection does not have Admin SDK credentials.");
  }
  try {
    return JSON.parse(decryptSecret(connection.encryptedCredentials, { userId: connection.userId, connectionId: connection.id }));
  } catch {
    throw new HttpError(500, "Stored credentials could not be decrypted. Was STUDIO_ENCRYPTION_KEY changed?");
  }
}

/** Resolves an owned Admin connection to a ready Firestore instance and codec. */
export async function openAdminFirestore(user, connectionId) {
  const connection = await getConnection(user, connectionId);
  if (connection.connectionType !== "admin") {
    throw new HttpError(400, "Web config connections are accessed directly from the browser with the Firebase Web SDK.");
  }
  const db = await getConnectionFirestore(connection, readServiceAccount(connection));
  return { connection, db, codec: createAdminCodec(db) };
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Verifies an Admin connection by listing root collections. */
export async function testAdminConnection(user, connectionId) {
  const started = Date.now();
  let result;
  try {
    const { db } = await openAdminFirestore(user, connectionId);
    const collections = await withTimeout(db.listCollections(), 15000, "Timed out after 15s waiting for Firestore.");
    result = {
      ok: true,
      message: `Connected. Found ${collections.length} root collection${collections.length === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) throw error;
    result = { ok: false, message: error?.message || "Connection failed." };
  }
  result.durationMs = Date.now() - started;
  await updateConnectionRecord(connectionId, {
    lastTestedAt: new Date().toISOString(),
    lastTestStatus: result.ok ? "ok" : "failed",
    lastTestMessage: result.message.slice(0, 500),
  });
  return result;
}

/** Records the outcome of a browser-side (Web SDK) connection test. */
export async function recordWebConnectionTest(user, connectionId, { ok, message }) {
  const connection = await getConnection(user, connectionId);
  if (connection.connectionType !== "web") throw new HttpError(400, "Not a web config connection.");
  return toPublicConnection(
    await updateConnectionRecord(connectionId, {
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: ok ? "ok" : "failed",
      lastTestMessage: String(message || "").slice(0, 500),
    }),
  );
}
