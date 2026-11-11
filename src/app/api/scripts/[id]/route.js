import { HttpError, json, readJson, route } from "@/lib/api/http";
import { getConnection } from "@/lib/firebase/connection-manager";
import { assertOwner } from "@/lib/security/permissions";
import { deleteScript, getScript, updateScript } from "@/lib/studio-db";
import { updateScriptSchema } from "@/lib/validators";
import { executionModeFor } from "@/lib/execution/modes";

async function ownedScript(user, id) {
  return assertOwner(await getScript(id), user, "Script");
}

export const GET = route(async ({ params, user }) => {
  return json({ script: await ownedScript(user, params.id) });
});

export const PUT = route(async ({ request, params, user }) => {
  await ownedScript(user, params.id);
  const input = await readJson(request, updateScriptSchema);
  const patch = { ...input };
  if (input.connectionId) {
    const connection = await getConnection(user, input.connectionId).catch(() => {
      throw new HttpError(400, "Unknown connection.");
    });
    patch.executionMode = executionModeFor(connection);
  }
  return json({ script: await updateScript(params.id, patch) });
});

export const DELETE = route(async ({ params, user }) => {
  await ownedScript(user, params.id);
  await deleteScript(params.id);
  return json({ ok: true });
});
