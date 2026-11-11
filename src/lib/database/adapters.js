"use client";

import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  limit as limitTo,
  orderBy as orderByField,
  query,
  runTransaction,
  setDoc,
  startAfter,
  where,
  writeBatch,
} from "firebase/firestore";
import { api, documentApiPath } from "@/lib/api/client";
import { createWebCodec, getWebFirestore } from "@/lib/firebase/client";

// The Database Explorer talks to Firestore through one of two adapters with an
// identical interface:
//   admin → Studio API routes → Firebase Admin SDK (credentials stay on the server)
//   web   → Firebase Web SDK in this browser tab (Security Rules enforced)
// All document data crossing this interface uses the tagged JSON format from
// lib/firestore/codec.js, so Firestore types are preserved.

const DOCUMENT_ID_FIELD = "__name__";

function createAdminAdapter(connection) {
  const connectionId = connection.id;
  return {
    kind: "admin",
    canListCollections: true,

    async listCollections(parentPath) {
      const { collections } = await api("/api/database/collections", { query: { connectionId, path: parentPath } });
      return collections;
    },

    async listDocuments({ collection: path, filters = [], orderBy, direction, limit = 50, cursor }) {
      return api("/api/database/documents", {
        query: {
          connectionId,
          collection: path,
          limit,
          cursor,
          orderBy,
          direction,
          filters: filters.length ? JSON.stringify(filters) : undefined,
        },
      });
    },

    async getDocument(path) {
      return api(documentApiPath(path), { query: { connectionId } });
    },

    async createDocument(path, id, data) {
      const { document } = await api("/api/database/documents", {
        method: "POST",
        body: { connectionId, collection: path, id: id || undefined, data },
      });
      return document;
    },

    async setDocument(path, data, { merge = false } = {}) {
      const { document } = await api(documentApiPath(path), { method: "PUT", body: { connectionId, data, merge } });
      return document;
    },

    async deleteDocument(path) {
      await api(documentApiPath(path), { method: "DELETE", query: { connectionId } });
    },

    async importDocuments(path, documents, { merge = false } = {}) {
      let imported = 0;
      for (let i = 0; i < documents.length; i += 500) {
        const result = await api("/api/database/import", {
          method: "POST",
          body: { connectionId, collection: path, merge, documents: documents.slice(i, i + 500) },
        });
        imported += result.imported;
      }
      return imported;
    },

    async test() {
      const { result } = await api(`/api/connections/${connectionId}/test`, { method: "POST", body: {} });
      return result;
    },
  };
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

const READ_TIMEOUT = "Firestore did not respond within 30s. Check your network, the projectId and the apiKey.";
const WRITE_TIMEOUT = "Firestore did not confirm the write within 30s. The Web SDK may still apply it once it reconnects.";
const timed = (promise, message) => withTimeout(promise, 30000, message);

function reportAudit(connectionId, operation, resource, metadata) {
  api("/api/audit", { method: "POST", body: { connectionId, operation, resource, metadata } }).catch(() => {});
}

function createWebAdapter(connection) {
  const db = getWebFirestore(connection);
  const codec = createWebCodec(db);
  const connectionId = connection.id;

  const serialize = (snapshot) => ({
    id: snapshot.id,
    path: snapshot.ref.path,
    exists: snapshot.exists(),
    data: snapshot.exists() ? codec.encodeDocument(snapshot.data()) : null,
    createTime: null,
    updateTime: null,
  });

  const field = (name) => (name === DOCUMENT_ID_FIELD ? documentId() : name);

  return {
    kind: "web",
    canListCollections: false,

    async listCollections() {
      return [];
    },

    async listDocuments({ collection: path, filters = [], orderBy, direction = "asc", limit = 50, cursor }) {
      const constraints = filters.map((filter) => {
        const value = codec.decode(filter.value);
        if (["in", "not-in", "array-contains-any"].includes(filter.op) && !Array.isArray(value)) {
          throw new Error(`Filter "${filter.op}" on "${filter.field}" needs an array value.`);
        }
        return where(field(filter.field), filter.op, value);
      });
      if (orderBy) constraints.push(orderByField(field(orderBy), direction));
      if (cursor) {
        const cursorSnapshot = await timed(getDoc(doc(db, path, cursor)), READ_TIMEOUT);
        if (!cursorSnapshot.exists()) throw new Error("The pagination cursor document no longer exists. Run the query again.");
        constraints.push(startAfter(cursorSnapshot));
      }
      constraints.push(limitTo(limit));
      const snapshot = await timed(getDocsFromServer(query(collection(db, path), ...constraints)), READ_TIMEOUT);
      const documents = snapshot.docs.map(serialize);
      return { documents, nextCursor: documents.length === limit ? documents.at(-1).id : null };
    },

    async getDocument(path) {
      return { document: serialize(await timed(getDocFromServer(doc(db, path)), READ_TIMEOUT)), subcollections: null };
    },

    async createDocument(path, id, data) {
      const decoded = codec.decodeDocument(data);
      const ref = id ? doc(db, path, id) : doc(collection(db, path));
      if (id) {
        await timed(
          runTransaction(db, async (transaction) => {
            const existing = await transaction.get(ref);
            if (existing.exists()) throw new Error(`Document "${id}" already exists.`);
            transaction.set(ref, decoded);
          }),
          WRITE_TIMEOUT,
        );
      } else {
        await timed(setDoc(ref, decoded), WRITE_TIMEOUT);
      }
      reportAudit(connectionId, "document.create", ref.path);
      return serialize(await timed(getDocFromServer(ref), READ_TIMEOUT));
    },

    async setDocument(path, data, { merge = false } = {}) {
      const ref = doc(db, path);
      await timed(setDoc(ref, codec.decodeDocument(data), { merge }), WRITE_TIMEOUT);
      reportAudit(connectionId, "document.update", path);
      return serialize(await timed(getDocFromServer(ref), READ_TIMEOUT));
    },

    async deleteDocument(path) {
      await timed(deleteDoc(doc(db, path)), WRITE_TIMEOUT);
      reportAudit(connectionId, "document.delete", path);
    },

    async importDocuments(path, documents, { merge = false } = {}) {
      for (let i = 0; i < documents.length; i += 500) {
        const batch = writeBatch(db);
        documents.slice(i, i + 500).forEach((item) => batch.set(doc(db, path, item.id), codec.decodeDocument(item.data), { merge }));
        await timed(batch.commit(), WRITE_TIMEOUT);
      }
      reportAudit(connectionId, "document.import", path, { count: documents.length, merge });
      return documents.length;
    },

    async test() {
      const started = Date.now();
      let result;
      try {
        await withTimeout(
          getDocsFromServer(query(collection(db, "__studio_connection_test__"), limitTo(1))),
          15000,
          "Timed out after 15s waiting for Firestore. Check the projectId and apiKey.",
        );
        result = { ok: true, message: "Connected. Firestore answered a test read." };
      } catch (error) {
        result =
          error?.code === "permission-denied"
            ? { ok: true, message: "Connected. Firestore is reachable; Security Rules denied the anonymous test read, as expected for locked-down projects." }
            : { ok: false, message: error?.message || "Connection failed." };
      }
      result.durationMs = Date.now() - started;
      await api(`/api/connections/${connectionId}/test`, { method: "POST", body: { ok: result.ok, message: result.message } }).catch(() => {});
      return result;
    },
  };
}

export function createDatabaseAdapter(connection) {
  if (!connection) return null;
  return connection.connectionType === "admin" ? createAdminAdapter(connection) : createWebAdapter(connection);
}
