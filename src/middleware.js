import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/security/session";

// Every Studio page and API requires a signed session cookie, except the
// login flow and the landing page. The browser execution sandbox (/sandbox/*)
// is static and deliberately cookie-less (it runs with an opaque origin).
const PUBLIC_PATHS = new Set(["/", "/login", "/api/auth/login", "/api/auth/logout"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Defence in depth against CSRF on top of SameSite=Strict cookies.
  if (isApi && !SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
    }
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Not signed in.", sessionExpired: true }, { status: 401 });

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sandbox/).*)"],
};
