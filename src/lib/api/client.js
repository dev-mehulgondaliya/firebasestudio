"use client";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** JSON fetch helper for Studio's own API. Redirects to /login when the session expired. */
export async function api(path, { method = "GET", body, signal, query } = {}) {
  let url = path;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const text = params.toString();
    if (text) url += `${url.includes("?") ? "&" : "?"}${text}`;
  }

  const response = await fetch(url, {
    method,
    signal,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Only a Studio session failure redirects; a rejected *project* credential must not.
    if (response.status === 401 && data?.sessionExpired && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status, data?.details);
  }
  return data;
}

/** Encodes a Firestore document path for the /api/database/documents/[...path] route. */
export function documentApiPath(path) {
  return `/api/database/documents/${path.split("/").map(encodeURIComponent).join("/")}`;
}
