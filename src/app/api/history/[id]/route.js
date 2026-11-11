import { json, route } from "@/lib/api/http";
import { assertOwner } from "@/lib/security/permissions";
import { getExecution } from "@/lib/studio-db";

export const GET = route(async ({ params, user }) => {
  return json({ execution: assertOwner(await getExecution(params.id), user, "Execution") });
});
