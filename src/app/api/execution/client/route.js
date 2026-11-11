import { HttpError, json, readJson, route } from "@/lib/api/http";
import { getConnection } from "@/lib/firebase/connection-manager";
import { prepareCode, prepareError, prepareOutput, prepareResult } from "@/lib/execution/history";
import { getScript, getSettings, recordExecution } from "@/lib/studio-db";
import { clientExecutionReportSchema } from "@/lib/validators";

// Browser executions run entirely in the user's sandboxed iframe with the
// Firebase Web SDK. The browser reports the finished run here so it appears
// in execution history alongside server runs.
export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, clientExecutionReportSchema);
  const connection = await getConnection(user, input.connectionId);
  if (connection.connectionType !== "web") {
    throw new HttpError(400, "Browser executions are only recorded for web config connections.");
  }
  if (input.scriptId) {
    const script = await getScript(input.scriptId);
    if (!script || script.userId !== user.uid) throw new HttpError(400, "Unknown script.");
  }

  const settings = await getSettings(user.uid);
  const { output, outputTruncated } = prepareOutput(input.logs, settings);
  const execution = await recordExecution(user.uid, {
    connectionId: connection.id,
    connectionName: connection.name,
    scriptId: input.scriptId || null,
    executionMode: "browser",
    code: prepareCode(input.code),
    status: input.status,
    durationMs: input.durationMs,
    output,
    outputTruncated,
    result: prepareResult(input.result, settings),
    error: prepareError(input.error),
  });
  return json({ executionId: execution.id }, { status: 201 });
});
