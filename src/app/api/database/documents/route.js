import { HttpError, json, parse, readJson, route, searchParams } from "@/lib/api/http";
import { openAdminFirestore } from "@/lib/firebase/connection-manager";
import { serializeSnapshot } from "@/lib/firebase/admin";
import { buildAdminQuery } from "@/lib/firestore/admin-query";
import { audit } from "@/lib/studio-db";
import { createDocumentSchema, listDocumentsSchema } from "@/lib/validators";

export const GET = route(async ({ request, user }) => {
  const input = parse(listDocumentsSchema, searchParams(request));
  const { db, codec } = await openAdminFirestore(user, input.connectionId);
  const query = await buildAdminQuery(db, codec, input);
  const snapshot = await query.get();
  const documents = snapshot.docs.map((doc) => serializeSnapshot(doc, codec));
  return json({
    documents,
    nextCursor: documents.length === input.limit ? documents.at(-1).id : null,
  });
});

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, createDocumentSchema);
  const { db, codec } = await openAdminFirestore(user, input.connectionId);

  let data;
  try {
    data = codec.decodeDocument(input.data);
  } catch (error) {
    throw new HttpError(400, error.message);
  }

  const collection = db.collection(input.collection);
  const ref = input.id ? collection.doc(input.id) : collection.doc();
  await ref.create(data); // fails with ALREADY_EXISTS (409) instead of overwriting
  await audit(user.uid, { connectionId: input.connectionId, operation: "document.create", resource: ref.path });

  return json({ document: serializeSnapshot(await ref.get(), codec) }, { status: 201 });
});
