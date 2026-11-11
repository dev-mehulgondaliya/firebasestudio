import { z } from "zod";
import { json, readJson, route } from "@/lib/api/http";
import { getConnection, recordWebConnectionTest, testAdminConnection } from "@/lib/firebase/connection-manager";

const webResultSchema = z.object({ ok: z.boolean(), message: z.string().max(2000) });

// Admin connections are tested on the server. Web config connections are tested
// in the browser (Web SDK) and only report their outcome here.
export const POST = route(async ({ request, params, user }) => {
  const connection = await getConnection(user, params.id);
  if (connection.connectionType === "admin") {
    return json({ result: await testAdminConnection(user, params.id) });
  }
  const result = await readJson(request, webResultSchema);
  await recordWebConnectionTest(user, params.id, result);
  return json({ result });
});
