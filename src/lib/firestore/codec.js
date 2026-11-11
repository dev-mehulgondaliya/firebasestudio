// Type-preserving JSON representation of Firestore data.
//
// Plain JSON cannot represent Firestore's special types, so the document
// editor, import/export and the API all use tagged values:
//
//   { "$timestamp": "2024-05-01T10:00:00.123456789Z" }   Timestamp (nanosecond precision)
//   { "$geopoint": { "latitude": 1.5, "longitude": 2 } }  GeoPoint
//   { "$ref": "users/alice" }                             DocumentReference
//   { "$bytes": "aGVsbG8=" }                              Bytes (base64)
//   { "$vector": [0.1, 0.2] }                             VectorValue
//   { "$number": "NaN" }                                  NaN / Infinity / -Infinity
//   { "$map": { "$ref": "not a reference" } }             escape for a real map whose
//                                                         only key looks like a tag
//
// The codec is SDK-agnostic: the Web SDK and Admin SDK each provide an adapter.

export const TYPE_TAGS = Object.freeze(["$timestamp", "$geopoint", "$ref", "$bytes", "$vector", "$number", "$map"]);
const TAGS = new Set(TYPE_TAGS);
const MAX_DEPTH = 64;

export class CodecError extends Error {}

export function formatTimestamp(seconds, nanoseconds) {
  const base = new Date(seconds * 1000).toISOString().slice(0, 19);
  return `${base}.${String(nanoseconds).padStart(9, "0")}Z`;
}

const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

/** Parses an ISO-8601 string into { seconds, nanoseconds } without losing sub-millisecond digits. */
export function parseTimestamp(text) {
  if (typeof text !== "string") throw new CodecError("$timestamp must be an ISO-8601 string");
  const match = TIMESTAMP_PATTERN.exec(text.trim());
  if (match) {
    const millis = Date.parse(`${match[1]}${match[3]}`);
    if (!Number.isNaN(millis)) {
      return { seconds: Math.floor(millis / 1000), nanoseconds: match[2] ? Number(match[2].padEnd(9, "0")) : 0 };
    }
  }
  const millis = Date.parse(text);
  if (Number.isNaN(millis)) throw new CodecError(`Invalid $timestamp "${text}"`);
  const seconds = Math.floor(millis / 1000);
  return { seconds, nanoseconds: (millis - seconds * 1000) * 1e6 };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * @param {object} adapter
 * @param {(v:any)=>boolean} adapter.isTimestamp
 * @param {(seconds:number, nanoseconds:number)=>any} adapter.timestamp
 * @param {(v:any)=>boolean} adapter.isGeoPoint
 * @param {(latitude:number, longitude:number)=>any} adapter.geoPoint
 * @param {(v:any)=>boolean} adapter.isReference
 * @param {(path:string)=>any} adapter.reference
 * @param {(v:any)=>boolean} adapter.isBytes
 * @param {(v:any)=>string} adapter.bytesToBase64
 * @param {(base64:string)=>any} adapter.bytesFromBase64
 * @param {(v:any)=>boolean} adapter.isVector
 * @param {(v:any)=>number[]} adapter.vectorToArray
 * @param {(values:number[])=>any} adapter.vector
 */
export function createFirestoreCodec(adapter) {
  function encode(value, depth = 0) {
    if (depth > MAX_DEPTH) throw new CodecError("Value is nested too deeply");
    if (value === null || value === undefined) return null;
    switch (typeof value) {
      case "string":
      case "boolean":
        return value;
      case "number":
        return Number.isFinite(value) ? value : { $number: String(value) };
      case "bigint":
        return Number(value);
      default:
        break;
    }
    if (Array.isArray(value)) return value.map((item) => encode(item, depth + 1));
    if (adapter.isTimestamp(value)) return { $timestamp: formatTimestamp(value.seconds, value.nanoseconds) };
    if (value instanceof Date) {
      const millis = value.getTime();
      const seconds = Math.floor(millis / 1000);
      return { $timestamp: formatTimestamp(seconds, (millis - seconds * 1000) * 1e6) };
    }
    if (adapter.isGeoPoint(value)) return { $geopoint: { latitude: value.latitude, longitude: value.longitude } };
    if (adapter.isReference(value)) return { $ref: value.path };
    if (adapter.isBytes(value)) return { $bytes: adapter.bytesToBase64(value) };
    if (adapter.isVector(value)) return { $vector: adapter.vectorToArray(value) };
    if (typeof value === "object") {
      const out = encodeMap(value, depth);
      const keys = Object.keys(out);
      return keys.length === 1 && TAGS.has(keys[0]) ? { $map: out } : out;
    }
    return String(value);
  }

  function encodeMap(map, depth = 0) {
    const out = {};
    for (const [key, item] of Object.entries(map)) out[key] = encode(item, depth + 1);
    return out;
  }

  function decode(json, depth = 0) {
    if (depth > MAX_DEPTH) throw new CodecError("Value is nested too deeply");
    if (json === null || json === undefined) return null;
    if (typeof json === "string" || typeof json === "boolean" || typeof json === "number") return json;
    if (Array.isArray(json)) return json.map((item) => decode(item, depth + 1));
    if (typeof json !== "object") throw new CodecError(`Unsupported value of type ${typeof json}`);

    const keys = Object.keys(json);
    if (keys.length === 1 && TAGS.has(keys[0])) {
      const tag = keys[0];
      const payload = json[tag];
      switch (tag) {
        case "$timestamp": {
          const { seconds, nanoseconds } = parseTimestamp(payload);
          return adapter.timestamp(seconds, nanoseconds);
        }
        case "$geopoint": {
          const latitude = Number(payload?.latitude);
          const longitude = Number(payload?.longitude);
          if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new CodecError("$geopoint.latitude must be between -90 and 90");
          if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new CodecError("$geopoint.longitude must be between -180 and 180");
          return adapter.geoPoint(latitude, longitude);
        }
        case "$ref": {
          const segments = typeof payload === "string" ? payload.replace(/^\/+|\/+$/g, "").split("/") : [];
          if (segments.length < 2 || segments.length % 2 !== 0 || segments.some((part) => !part)) {
            throw new CodecError(`$ref must be a document path like "users/alice", got ${JSON.stringify(payload)}`);
          }
          return adapter.reference(segments.join("/"));
        }
        case "$bytes":
          if (typeof payload !== "string") throw new CodecError("$bytes must be a base64 string");
          return adapter.bytesFromBase64(payload);
        case "$vector":
          if (!Array.isArray(payload) || payload.some((item) => typeof item !== "number")) {
            throw new CodecError("$vector must be an array of numbers");
          }
          return adapter.vector(payload);
        case "$number":
          if (!["NaN", "Infinity", "-Infinity"].includes(payload)) throw new CodecError('$number must be "NaN", "Infinity" or "-Infinity"');
          return Number(payload);
        case "$map":
          if (!isPlainObject(payload)) throw new CodecError("$map must wrap an object");
          return decodeMap(payload, depth);
        default:
          break;
      }
    }
    return decodeMap(json, depth);
  }

  function decodeMap(json, depth = 0) {
    const out = {};
    for (const [key, item] of Object.entries(json)) out[key] = decode(item, depth + 1);
    return out;
  }

  return {
    encode,
    decode,
    /** Encodes a document's data map (never wraps the top level in $map). */
    encodeDocument: (data) => encodeMap(data || {}),
    /** Decodes a document's data map; the top level must be an object. */
    decodeDocument: (json) => {
      if (!isPlainObject(json)) throw new CodecError("Document data must be a JSON object");
      return decodeMap(json);
    },
  };
}
