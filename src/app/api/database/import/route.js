import { HttpError, json, readJson, route } from "@/lib/api/http";
import { openAdminFirestore } from "@/lib/firebase/connection-manager";
import { audit } from "@/lib/studio-db";
import { importDocumentsSchema } from "@/lib/validators";

// Writes up to 500 documents in one atomic batch. The client splits larger files.
export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, importDocumentsSchema);
  const { db, codec } = await openAdminFirestore(user, input.connectionId);
  const collection = db.collection(input.collection);
  const batch = db.batch();

  input.documents.forEach((doc, index) => {
    let data;
    try {
      data = codec.decodeDocument(doc.data);
    } catch (error) {
      throw new HttpError(400, `Document #${index + 1} (${doc.id}): ${error.message}`);
    }
    batch.set(collection.doc(doc.id), data, { merge: input.merge });
  });

  await batch.commit();
  await audit(user.uid, {
    connectionId: input.connectionId,
    operation: "document.import",
    resource: input.collection,
    metadata: { count: input.documents.length, merge: input.merge },
  });
  return json({ imported: input.documents.length });
});
