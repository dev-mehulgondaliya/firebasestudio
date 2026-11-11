import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Local JSON-file backend for Studio's own data. Intended for single-instance,
// local development. All writes are serialised through one process-wide queue
// and written atomically (temp file + rename).

const DATA_DIR = path.join(process.cwd(), ".studio-data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const COLLECTIONS = ["users", "connections", "scripts", "executionHistory", "auditLogs"];

// Keep a single lock across Next.js dev hot reloads.
const state = (globalThis.__studioFileStore ??= { queue: Promise.resolve() });

function emptyDb() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, {}]));
}

async function load() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return { ...emptyDb(), ...JSON.parse(raw) };
  } catch (error) {
    if (error.code === "ENOENT") return emptyDb();
    throw error;
  }
}

async function save(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(db, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temp, DATA_FILE);
}

function exclusive(task) {
  const run = state.queue.then(task, task);
  state.queue = run.catch(() => {});
  return run;
}

function matches(doc, where) {
  return Object.entries(where || {}).every(([field, value]) => value === undefined || doc[field] === value);
}

export const fileStore = {
  kind: "file",
  location: DATA_FILE,

  async create(collection, data, id = crypto.randomUUID()) {
    return exclusive(async () => {
      const db = await load();
      const doc = { ...data, id };
      db[collection][id] = doc;
      await save(db);
      return doc;
    });
  },

  async get(collection, id) {
    const db = await load();
    return db[collection][id] ?? null;
  },

  async set(collection, id, data) {
    return exclusive(async () => {
      const db = await load();
      const doc = { ...data, id };
      db[collection][id] = doc;
      await save(db);
      return doc;
    });
  },

  async update(collection, id, patch) {
    return exclusive(async () => {
      const db = await load();
      if (!db[collection][id]) return null;
      const doc = { ...db[collection][id], ...patch, id };
      db[collection][id] = doc;
      await save(db);
      return doc;
    });
  },

  async delete(collection, id) {
    return exclusive(async () => {
      const db = await load();
      delete db[collection][id];
      await save(db);
    });
  },

  async list(collection, { where, orderBy = "createdAt", direction = "desc", limit = 100 } = {}) {
    const db = await load();
    const docs = Object.values(db[collection]).filter((doc) => matches(doc, where));
    docs.sort((a, b) => {
      const left = a[orderBy] ?? "";
      const right = b[orderBy] ?? "";
      if (left === right) return 0;
      const order = left < right ? -1 : 1;
      return direction === "desc" ? -order : order;
    });
    return docs.slice(0, limit);
  },

  async count(collection, { where } = {}) {
    const db = await load();
    return Object.values(db[collection]).filter((doc) => matches(doc, where)).length;
  },

  /** Deletes the oldest matching documents so at most `keep` remain. */
  async prune(collection, { where, keep }) {
    return exclusive(async () => {
      const db = await load();
      const docs = Object.values(db[collection])
        .filter((doc) => matches(doc, where))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const stale = docs.slice(keep);
      if (stale.length === 0) return 0;
      for (const doc of stale) delete db[collection][doc.id];
      await save(db);
      return stale.length;
    });
  },

  async deleteWhere(collection, where) {
    return exclusive(async () => {
      const db = await load();
      let removed = 0;
      for (const doc of Object.values(db[collection])) {
        if (matches(doc, where)) {
          delete db[collection][doc.id];
          removed += 1;
        }
      }
      if (removed) await save(db);
      return removed;
    });
  },
};
