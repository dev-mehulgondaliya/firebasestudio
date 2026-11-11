import crypto from "node:crypto";

// AES-256-GCM envelope for Firebase service-account credentials.
// Format: v1.<iv>.<authTag>.<ciphertext>  (base64url parts)
// The ciphertext is bound to its owner and connection through additional
// authenticated data, so an encrypted blob cannot be moved to another record.

const VERSION = "v1";

function getKey() {
  const raw = process.env.STUDIO_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("STUDIO_ENCRYPTION_KEY is not configured. Credentials cannot be stored or read.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("STUDIO_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function isEncryptionConfigured() {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

function aad(context) {
  return Buffer.from(`${context.userId}:${context.connectionId}`, "utf8");
}

export function encryptSecret(plaintext, context) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(aad(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(envelope, context) {
  const [version, iv, tag, ciphertext] = String(envelope).split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported credential envelope.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(aad(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
