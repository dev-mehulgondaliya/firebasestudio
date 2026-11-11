import { HttpError, json, readJson, route } from "@/lib/api/http";
import { getConnection, readServiceAccount } from "@/lib/firebase/connection-manager";
import { prepareCode, prepareError, prepareOutput, prepareResult } from "@/lib/execution/history";
import { runServerScript } from "@/lib/execution/server-runner";
import { assertServerExecutionAllowed } from "@/lib/security/permissions";
import { audit, getScript, getSettings, recordExecution } from "@/lib/studio-db";
import { serverExecutionSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 130;

// Runs a script with the Firebase Admin SDK in an isolated worker process.
// The private key is decrypted here and handed to that single worker only.
export const POST = route(async ({ request, user }) => {
  assertServerExecutionAllowed();
  const input = await readJson(request, serverExecutionSchema);
  const connection = await getConnection(user, input.connectionId);
  if (connection.connectionType !== "admin") {
    throw new HttpError(400, "Server execution requires an Admin SDK (service account) connection.");
  }
  if (input.scriptId) {
    const script = await getScript(input.scriptId);
    if (!script || script.userId !== user.uid) throw new HttpError(400, "Unknown script.");
  }

  const settings = await getSettings(user.uid);
  const timeoutMs = input.timeoutMs ?? settings.defaultTimeoutSeconds * 1000;

  let outcome;
  try {
    outcome = await runServerScript({
      code: input.code,
      serviceAccount: readServiceAccount(connection),
      projectId: connection.projectId,
      timeoutMs,
    });
  } catch (error) {
    if (error.status === 429) throw new HttpError(429, error.message);
    throw error;
  }

  const { output, outputTruncated } = prepareOutput(outcome.logs, settings);
  const execution = await recordExecution(user.uid, {
    connectionId: connection.id,
    connectionName: connection.name,
    scriptId: input.scriptId || null,
    executionMode: "server",
    code: prepareCode(input.code),
    status: outcome.status,
    durationMs: outcome.durationMs,
    output,
    outputTruncated: outputTruncated || outcome.logsTruncated,
    result: prepareResult(outcome.result, settings),
    error: prepareError(outcome.error),
  });
  await audit(user.uid, {
    connectionId: connection.id,
    operation: "execution.server",
    resource: input.scriptId ? `scripts/${input.scriptId}` : "playground",
    metadata: { status: outcome.status, durationMs: outcome.durationMs },
  });

  return json({ executionId: execution.id, ...outcome });
});
