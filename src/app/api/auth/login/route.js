import crypto from "node:crypto";
import { HttpError, json, publicRoute, readJson } from "@/lib/api/http";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/security/session";
import { loginSchema } from "@/lib/validators";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = (globalThis.__studioLoginAttempts ??= new Map());

function clientKey(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    throw new HttpError(429, "Too many failed sign-in attempts. Try again in a few minutes.");
  }
}

function passwordMatches(candidate, expected) {
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export const POST = publicRoute(async ({ request }) => {
  const expected = process.env.STUDIO_PASSWORD;
  const secret = process.env.STUDIO_SESSION_SECRET;
  if (!expected || !secret || secret.length < 32) {
    throw new HttpError(
      503,
      "Studio is not configured. Set STUDIO_PASSWORD and STUDIO_SESSION_SECRET (32+ chars) in .env.local and restart.",
    );
  }

  const key = clientKey(request);
  checkRateLimit(key);
  const { password } = await readJson(request, loginSchema);

  if (!passwordMatches(password, expected)) {
    attempts.get(key).count += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    throw new HttpError(401, "Incorrect password.");
  }
  attempts.delete(key);

  const email = process.env.STUDIO_OWNER_EMAIL || "owner@localhost";
  const token = await createSessionToken({ uid: "owner", email });
  const response = json({ ok: true, user: { uid: "owner", email } });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
});
