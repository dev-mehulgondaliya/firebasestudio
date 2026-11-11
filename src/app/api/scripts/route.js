import { HttpError, json, readJson, route, searchParams } from "@/lib/api/http";
import { getConnection } from "@/lib/firebase/connection-manager";
import { createScript, listScripts } from "@/lib/studio-db";
import { createScriptSchema } from "@/lib/validators";
import { executionModeFor } from "@/lib/execution/modes";

export const GET = route(async ({ request, user }) => {
  const { connectionId } = searchParams(request);
  return json({ scripts: await listScripts(user.uid, { connectionId: connectionId || undefined }) });
});

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, createScriptSchema);
  let executionMode = "browser";
  if (input.connectionId) {
    const connection = await getConnection(user, input.connectionId).catch(() => {
      throw new HttpError(400, "Unknown connection.");
    });
    executionMode = executionModeFor(connection);
  }
  const script = await createScript(user.uid, {
    name: input.name,
    code: input.code,
    description: input.description || "",
    connectionId: input.connectionId || null,
    executionMode,
  });
  return json({ script }, { status: 201 });
});
