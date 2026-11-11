import { json, readJson, route } from "@/lib/api/http";
import { createConnection, listConnections } from "@/lib/firebase/connection-manager";
import { createConnectionSchema } from "@/lib/validators";

export const GET = route(async ({ user }) => {
  return json({ connections: await listConnections(user) });
});

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, createConnectionSchema);
  const connection = await createConnection(user, input);
  return json({ connection }, { status: 201 });
});
