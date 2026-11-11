import { json, publicRoute } from "@/lib/api/http";
import { SESSION_COOKIE } from "@/lib/security/session";

export const POST = publicRoute(async () => {
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
});
