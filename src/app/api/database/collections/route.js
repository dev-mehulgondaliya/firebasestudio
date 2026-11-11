import { json, parse, route, searchParams } from "@/lib/api/http";
import { openAdminFirestore } from "@/lib/firebase/connection-manager";
import { z } from "zod";
import { documentPathSchema } from "@/lib/validators";

const querySchema = z.object({
  connectionId: z.string().min(1),
  // Optional document path: list that document's subcollections instead of root collections.
  path: documentPathSchema.optional(),
});

export const GET = route(async ({ request, user }) => {
  const { connectionId, path } = parse(querySchema, searchParams(request));
  const { db } = await openAdminFirestore(user, connectionId);
  const collections = path ? await db.doc(path).listCollections() : await db.listCollections();
  return json({
    collections: collections
      .map((ref) => ({ id: ref.id, path: ref.path }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
});
