import { json, readJson, route, searchParams } from "@/lib/api/http";
import { getConnection } from "@/lib/firebase/connection-manager";
import { audit, listAuditLogs } from "@/lib/studio-db";
import { auditEventSchema } from "@/lib/validators";

export const GET = route(async ({ request, user }) => {
  const limit = Math.min(Number(searchParams(request).limit) || 50, 200);
  return json({ auditLogs: await listAuditLogs(user.uid, { limit }) });
});

// Web config connections write to Firestore directly from the browser, so the
// browser reports those changes here to keep the audit trail complete.
export const POST = route(async ({ request, user }) => {
  const event = await readJson(request, auditEventSchema);
  if (event.connectionId) await getConnection(user, event.connectionId);
  await audit(user.uid, { ...event, metadata: { ...(event.metadata || {}), reportedBy: "browser" } });
  return json({ ok: true }, { status: 201 });
});
