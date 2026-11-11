import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/security/session";
import { HttpError } from "@/lib/api/errors";

export async function getCurrentUser() {
  const store = await cookies();
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  return { uid: payload.uid, email: payload.email || null };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw Object.assign(new HttpError(401, "Not signed in."), { sessionExpired: true });
  return user;
}

/** Hides other users' resources behind a 404 so their existence is not revealed. */
export function assertOwner(resource, user, label = "Resource") {
  if (!resource || resource.userId !== user.uid) {
    throw new HttpError(404, `${label} not found.`);
  }
  return resource;
}

export function isServerExecutionEnabled() {
  return (process.env.STUDIO_SERVER_EXECUTION || "enabled").toLowerCase() !== "disabled";
}

export function assertServerExecutionAllowed() {
  if (!isServerExecutionEnabled()) {
    throw new HttpError(403, "Server-side (Admin SDK) execution is disabled on this Studio instance.");
  }
}
