import { z } from "zod";
import { json, parse, route, searchParams } from "@/lib/api/http";
import { clearExecutions, listExecutions } from "@/lib/studio-db";

const querySchema = z.object({
  connectionId: z.string().min(1).optional(),
  scriptId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const GET = route(async ({ request, user }) => {
  const filters = parse(querySchema, searchParams(request));
  const executions = await listExecutions(user.uid, filters);
  // The list view does not need full output; fetch a single run for details.
  return json({
    executions: executions.map(({ output, result, code, ...summary }) => ({
      ...summary,
      hasOutput: Boolean(output?.length),
      codePreview: (code || "").slice(0, 200),
    })),
  });
});

export const DELETE = route(async ({ user }) => {
  const removed = await clearExecutions(user.uid);
  return json({ removed });
});
