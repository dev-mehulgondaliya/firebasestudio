import { json, readJson, route } from "@/lib/api/http";
import { getConnection, removeConnection, renameConnection } from "@/lib/firebase/connection-manager";
import { toPublicConnection } from "@/lib/studio-db";
import { updateConnectionSchema } from "@/lib/validators";

export const GET = route(async ({ params, user }) => {
  return json({ connection: toPublicConnection(await getConnection(user, params.id)) });
});

export const PATCH = route(async ({ request, params, user }) => {
  const { name } = await readJson(request, updateConnectionSchema);
  const connection = name ? await renameConnection(user, params.id, name) : toPublicConnection(await getConnection(user, params.id));
  return json({ connection });
});

export const DELETE = route(async ({ params, user }) => {
  await removeConnection(user, params.id);
  return json({ ok: true });
});
