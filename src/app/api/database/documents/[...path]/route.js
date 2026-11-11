import { z } from "zod";
import { HttpError, json, parse, readJson, route, searchParams } from "@/lib/api/http";
import { openAdminFirestore } from "@/lib/firebase/connection-manager";
import { serializeSnapshot } from "@/lib/firebase/admin";
import { audit } from "@/lib/studio-db";
import { documentPathSchema, writeDocumentSchema } from "@/lib/validators";

const connectionQuery = z.object({ connectionId: z.string().min(1) });

function documentPath(params) {
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  return parse(documentPathSchema, segments.map((segment) => decodeURIComponent(segment)).join("/"));
}

export const GET = route(async ({ request, params, user }) => {
  const { connectionId } = parse(connectionQuery, searchParams(request));
  const path = documentPath(params);
  const { db, codec } = await openAdminFirestore(user, connectionId);
  const ref = db.doc(path);
  const [snapshot, subcollections] = await Promise.all([ref.get(), ref.listCollections()]);
  return json({
    document: serializeSnapshot(snapshot, codec),
    subcollections: subcollections.map((col) => ({ id: col.id, path: col.path })),
  });
});

// Replaces the document (or merges when `merge: true`). Types are preserved by the codec.
export const PUT = route(async ({ request, params, user }) => {
  const path = documentPath(params);
  const input = await readJson(request, writeDocumentSchema);
  const { db, codec } = await openAdminFirestore(user, input.connectionId);

  let data;
  try {
    data = codec.decodeDocument(input.data);
  } catch (error) {
    throw new HttpError(400, error.message);
  }

  const ref = db.doc(path);
  await ref.set(data, { merge: input.merge });
  await audit(user.uid, { connectionId: input.connectionId, operation: "document.update", resource: path });
  return json({ document: serializeSnapshot(await ref.get(), codec) });
});

// Deletes a single document. Subcollections are not deleted (Firestore semantics).
export const DELETE = route(async ({ request, params, user }) => {
  const { connectionId } = parse(connectionQuery, searchParams(request));
  const path = documentPath(params);
  const { db } = await openAdminFirestore(user, connectionId);
  await db.doc(path).delete();
  await audit(user.uid, { connectionId, operation: "document.delete", resource: path });
  return json({ ok: true });
});
