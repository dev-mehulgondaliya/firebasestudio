// Signed session tokens built on Web Crypto so the same code runs in the
// Edge middleware and in Node.js route handlers.

export const SESSION_COOKIE = "fs_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const keyCache = new Map();

async function getKey(secret) {
  if (!secret || secret.length < 32) {
    throw new Error("STUDIO_SESSION_SECRET must be set and at least 32 characters long.");
  }
  if (!keyCache.has(secret)) {
    keyCache.set(
      secret,
      crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
        "sign",
        "verify",
      ]),
    );
  }
  return keyCache.get(secret);
}

export function getSessionSecret() {
  return process.env.STUDIO_SESSION_SECRET || "";
}

export async function createSessionToken(payload, secret = getSessionSecret()) {
  const now = Math.floor(Date.now() / 1000);
  const body = toBase64Url(encoder.encode(JSON.stringify({ ...payload, iat: now, exp: now + SESSION_TTL_SECONDS })));
  const signature = await crypto.subtle.sign("HMAC", await getKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the session payload, or null when the token is missing, forged or expired. */
export async function verifySessionToken(token, secret = getSessionSecret()) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  try {
    const [body, signature] = token.split(".");
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(secret),
      fromBase64Url(signature),
      encoder.encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(fromBase64Url(body)));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.uid !== "string" || !payload.uid) return null;
    return payload;
  } catch {
    return null;
  }
}
