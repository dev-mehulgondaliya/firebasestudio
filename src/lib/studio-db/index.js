import crypto from "node:crypto";
import { fileStore } from "@/lib/studio-db/file-store";
import { firestoreStore } from "@/lib/studio-db/firestore-store";

// Repository for Firebase Studio's *own* data: users, connections, scripts,
// execution history and audit logs. Never stores data from connected projects.

const HISTORY_LIMIT_PER_USER = 500;
const AUDIT_LIMIT_PER_USER = 2000;

export const DEFAULT_SETTINGS = Object.freeze({
  storeOutputInHistory: true,
  confirmDeletes: true,
  defaultTimeoutSeconds: 30,
});

export function getStore() {
  return process.env.STUDIO_FIREBASE_SERVICE_ACCOUNT ? firestoreStore : fileStore;
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- settings

export async function getSettings(uid) {
  const user = await getStore().get("users", uid);
  return { ...DEFAULT_SETTINGS, ...(user?.settings || {}) };
}

export async function updateSettings(uid, patch) {
  const store = getStore();
  const existing = await store.get("users", uid);
  const settings = { ...DEFAULT_SETTINGS, ...(existing?.settings || {}), ...patch };
  await store.set("users", uid, {
    ...(existing || { createdAt: now() }),
    userId: uid,
    settings,
    updatedAt: now(),
  });
  return settings;
}

// ------------------------------------------------------------- connections

/** Strips encrypted credentials. This is the only shape ever sent to the browser. */
export function toPublicConnection(record) {
  if (!record) return null;
  // eslint-disable-next-line no-unused-vars
  const { encryptedCredentials, ...rest } = record;
  return { ...rest, hasCredentials: Boolean(encryptedCredentials) };
}

export async function listConnectionRecords(uid) {
  return getStore().list("connections", { where: { userId: uid }, orderBy: "createdAt", direction: "asc", limit: 200 });
}

export async function getConnectionRecord(id) {
  return getStore().get("connections", id);
}

export async function insertConnectionRecord(id, record) {
  return getStore().create("connections", { ...record, createdAt: now(), updatedAt: now() }, id);
}

export async function updateConnectionRecord(id, patch) {
  return getStore().update("connections", id, { ...patch, updatedAt: now() });
}

export async function deleteConnectionRecord(id) {
  await getStore().delete("connections", id);
}

// ----------------------------------------------------------------- scripts

export async function listScripts(uid, { connectionId } = {}) {
  return getStore().list("scripts", { where: { userId: uid, connectionId }, orderBy: "updatedAt", direction: "desc", limit: 500 });
}

export async function getScript(id) {
  return getStore().get("scripts", id);
}

export async function createScript(uid, data) {
  return getStore().create(
    "scripts",
    { ...data, userId: uid, createdAt: now(), updatedAt: now() },
    crypto.randomUUID(),
  );
}

export async function updateScript(id, patch) {
  return getStore().update("scripts", id, { ...patch, updatedAt: now() });
}

export async function deleteScript(id) {
  await getStore().delete("scripts", id);
}

// -------------------------------------------------------- execution history

export async function recordExecution(uid, entry) {
  const store = getStore();
  const doc = await store.create(
    "executionHistory",
    { ...entry, userId: uid, createdAt: now() },
    crypto.randomUUID(),
  );
  store.prune("executionHistory", { where: { userId: uid }, keep: HISTORY_LIMIT_PER_USER }).catch(() => {});
  return doc;
}

export async function listExecutions(uid, { connectionId, scriptId, limit = 100 } = {}) {
  return getStore().list("executionHistory", {
    where: { userId: uid, connectionId, scriptId },
    orderBy: "createdAt",
    direction: "desc",
    limit,
  });
}

export async function getExecution(id) {
  return getStore().get("executionHistory", id);
}

export async function clearExecutions(uid) {
  return getStore().deleteWhere("executionHistory", { userId: uid });
}

// --------------------------------------------------------------- audit logs

export async function audit(uid, { connectionId = null, operation, resource = null, metadata = null }) {
  const store = getStore();
  try {
    await store.create(
      "auditLogs",
      { userId: uid, connectionId, operation, resource, metadata, createdAt: now() },
      crypto.randomUUID(),
    );
    store.prune("auditLogs", { where: { userId: uid }, keep: AUDIT_LIMIT_PER_USER }).catch(() => {});
  } catch (error) {
    // Auditing must never break the operation it describes.
    console.error("[audit] failed to record", operation, error?.message);
  }
}

export async function listAuditLogs(uid, { limit = 50 } = {}) {
  return getStore().list("auditLogs", { where: { userId: uid }, orderBy: "createdAt", direction: "desc", limit });
}

// --------------------------------------------------------------- dashboard

export async function getOverview(uid) {
  const store = getStore();
  const [connections, scriptCount, executions, auditLogs] = await Promise.all([
    listConnectionRecords(uid),
    store.count("scripts", { where: { userId: uid } }),
    listExecutions(uid, { limit: 200 }),
    listAuditLogs(uid, { limit: 8 }),
  ]);
  const succeeded = executions.filter((run) => run.status === "success").length;
  return {
    connections: connections.map(toPublicConnection),
    scriptCount,
    executionCount: executions.length,
    successRate: executions.length ? Math.round((succeeded / executions.length) * 100) : null,
    recentExecutions: executions.slice(0, 6),
    auditLogs,
  };
}
