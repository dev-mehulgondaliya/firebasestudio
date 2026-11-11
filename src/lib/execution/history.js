// Helpers for persisting execution results without leaking secrets.

const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const MAX_STORED_OUTPUT_BYTES = 32 * 1024;
const MAX_STORED_CODE_BYTES = 200 * 1024;

export function redactSecrets(value, depth = 0) {
  if (depth > 20) return value;
  if (typeof value === "string") return value.replace(PRIVATE_KEY_PATTERN, "[REDACTED PRIVATE KEY]");
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactSecrets(item, depth + 1)]));
  }
  return value;
}

/** Truncates console output so a history record stays small. Returns null when output storage is off. */
export function prepareOutput(logs, { storeOutputInHistory }) {
  if (!storeOutputInHistory) return { output: null, outputTruncated: false };
  const kept = [];
  let bytes = 0;
  for (const entry of logs || []) {
    const clean = redactSecrets(entry);
    const size = JSON.stringify(clean).length;
    if (bytes + size > MAX_STORED_OUTPUT_BYTES) {
      return { output: kept, outputTruncated: true };
    }
    bytes += size;
    kept.push(clean);
  }
  return { output: kept, outputTruncated: false };
}

export function prepareCode(code) {
  return code.length > MAX_STORED_CODE_BYTES ? code.slice(0, MAX_STORED_CODE_BYTES) : code;
}

export function prepareResult(result, { storeOutputInHistory }) {
  if (!storeOutputInHistory || result === undefined) return null;
  const clean = redactSecrets(result);
  return JSON.stringify(clean).length > MAX_STORED_OUTPUT_BYTES ? { $type: "truncated", preview: "Result too large to store" } : clean;
}

export function prepareError(error) {
  if (!error) return null;
  return redactSecrets({
    name: String(error.name || "Error").slice(0, 200),
    message: String(error.message || "").slice(0, 5000),
    line: Number.isInteger(error.line) ? error.line : null,
    column: Number.isInteger(error.column) ? error.column : null,
    code: error.code ? String(error.code).slice(0, 100) : null,
  });
}
