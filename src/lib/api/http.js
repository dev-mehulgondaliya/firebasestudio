import { NextResponse } from "next/server";
import { requireUser } from "@/lib/security/permissions";
import { HttpError } from "@/lib/api/errors";

export { HttpError };

export function json(data, init) {
  return NextResponse.json(data, init);
}

// gRPC status codes returned by the Firestore Admin SDK.
const GRPC_STATUS = {
  3: 400, // INVALID_ARGUMENT
  4: 504, // DEADLINE_EXCEEDED
  5: 404, // NOT_FOUND
  6: 409, // ALREADY_EXISTS
  7: 403, // PERMISSION_DENIED
  8: 429, // RESOURCE_EXHAUSTED
  9: 400, // FAILED_PRECONDITION (e.g. missing composite index)
  14: 503, // UNAVAILABLE
  // UNAUTHENTICATED means the *project's* credentials were rejected. Never use
  // 401 for that: 401 is reserved for an expired Studio session.
  16: 502,
};

function statusFor(error) {
  if (error instanceof HttpError) return error.status;
  if (typeof error?.code === "number" && GRPC_STATUS[error.code]) return GRPC_STATUS[error.code];
  if (/invalid_grant|invalid_client|account not found/i.test(error?.message || "")) return 502;
  return 500;
}

function toErrorResponse(error) {
  const status = statusFor(error);
  // Log only the message: request bodies may contain credentials or script code.
  if (status >= 500) console.error("[api]", error?.message || error);
  const message =
    error instanceof HttpError || status !== 500
      ? error.message
      : `Unexpected error: ${error?.message || "unknown"}`;
  const body = { error: message, details: error?.details };
  if (error?.sessionExpired) body.sessionExpired = true;
  return json(body, { status });
}

/** Wraps an authenticated route handler: resolves the user and params and maps errors to JSON. */
export function route(handler) {
  return async (request, context) => {
    try {
      const user = await requireUser();
      const params = context?.params ? await context.params : {};
      return await handler({ request, params, user });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Same as route() but without requiring a session (login endpoints). */
export function publicRoute(handler) {
  return async (request, context) => {
    try {
      const params = context?.params ? await context.params : {};
      return await handler({ request, params });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const first = details[0];
    throw new HttpError(400, first ? `${first.path ? `${first.path}: ` : ""}${first.message}` : "Invalid request", details);
  }
  return result.data;
}

export async function readJson(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  return parse(schema, body);
}

export function searchParams(request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
