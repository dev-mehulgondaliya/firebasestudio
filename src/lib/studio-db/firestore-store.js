import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firestore backend for Studio's own data. It lives in a dedicated Firebase
// project (STUDIO_FIREBASE_SERVICE_ACCOUNT), completely separate from any
// project a user connects to. All access goes through the Next.js server;
// see firestore.rules, which denies direct client access.

const APP_NAME = "firebase-studio-internal";

export function readStudioServiceAccount() {
  const raw = process.env.STUDIO_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text);
}

function db() {
  const app = getApps().some((existing) => existing.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp({ credential: cert(readStudioServiceAccount()) }, APP_NAME);
  return getFirestore(app);
}

function applyWhere(query, where) {
  let result = query;
  for (const [field, value] of Object.entries(where || {})) {
    if (value !== undefined) result = result.where(field, "==", value);
  }
  return result;
}

const BATCH_LIMIT = 400;

async function deleteRefs(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
}

export const firestoreStore = {
  kind: "firestore",
  get location() {
    return `firestore://${readStudioServiceAccount()?.project_id ?? "unknown"}`;
  },

  async create(collection, data, id) {
    const ref = id ? db().collection(collection).doc(id) : db().collection(collection).doc();
    const doc = { ...data, id: ref.id };
    await ref.create(doc);
    return doc;
  },

  async get(collection, id) {
    const snapshot = await db().collection(collection).doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  },

  async set(collection, id, data) {
    const doc = { ...data, id };
    await db().collection(collection).doc(id).set(doc);
    return doc;
  },

  async update(collection, id, patch) {
    const ref = db().collection(collection).doc(id);
    try {
      await ref.update(patch);
    } catch (error) {
      if (error.code === 5) return null; // NOT_FOUND
      throw error;
    }
    return (await ref.get()).data();
  },

  async delete(collection, id) {
    await db().collection(collection).doc(id).delete();
  },

  // Composite indexes for these queries are declared in firestore.indexes.json.
  async list(collection, { where, orderBy = "createdAt", direction = "desc", limit = 100 } = {}) {
    const snapshot = await applyWhere(db().collection(collection), where)
      .orderBy(orderBy, direction)
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  },

  async count(collection, { where } = {}) {
    const snapshot = await applyWhere(db().collection(collection), where).count().get();
    return snapshot.data().count;
  },

  async prune(collection, { where, keep }) {
    const snapshot = await applyWhere(db().collection(collection), where)
      .orderBy("createdAt", "desc")
      .offset(keep)
      .select()
      .get();
    return deleteRefs(snapshot.docs.map((doc) => doc.ref));
  },

  async deleteWhere(collection, where) {
    const snapshot = await applyWhere(db().collection(collection), where).select().get();
    return deleteRefs(snapshot.docs.map((doc) => doc.ref));
  },
};
