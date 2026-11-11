// Turns display values produced by public/sandbox/serializer.js into readable,
// JavaScript-like text for the output console.

const LINE_WIDTH = 80;

function pad(depth) {
  return "  ".repeat(depth);
}

function join(open, close, parts, depth) {
  if (parts.length === 0) return `${open}${close}`;
  const single = `${open} ${parts.join(", ")} ${close}`;
  if (single.length <= LINE_WIDTH && !single.includes("\n")) return single;
  return `${open}\n${parts.map((part) => `${pad(depth + 1)}${part}`).join(",\n")}\n${pad(depth)}${close}`;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function formatKey(key) {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

function formatTagged(value, depth) {
  switch (value.$type) {
    case "undefined":
      return "undefined";
    case "number":
      return value.value;
    case "bigint":
      return `${value.value}n`;
    case "symbol":
      return value.value;
    case "function":
      return `ƒ ${value.name}()`;
    case "error":
      return `${value.name}: ${value.message}`;
    case "date":
      return `Date(${value.value})`;
    case "timestamp":
      return `Timestamp(${value.value})`;
    case "geopoint":
      return `GeoPoint(${value.latitude}, ${value.longitude})`;
    case "ref":
      return `DocumentReference(${value.path})`;
    case "collectionRef":
      return `CollectionReference(${value.path})`;
    case "bytes":
      return `Bytes(${value.length}) <${value.preview}>`;
    case "vector":
      return `Vector[${value.values.join(", ")}]`;
    case "promise":
      return "Promise { <pending> }";
    case "circular":
      return "[Circular]";
    case "truncated":
      return value.preview;
    case "more":
      return `… ${value.count} more`;
    case "map":
      return `Map(${value.size}) ${join("{", "}", value.entries.map(([k, v]) => `${format(k, depth + 1)} => ${format(v, depth + 1)}`), depth)}`;
    case "set":
      return `Set(${value.size}) ${join("{", "}", value.values.map((v) => format(v, depth + 1)), depth)}`;
    case "querySnapshot":
      return `QuerySnapshot(size: ${value.size}) ${join("[", "]", value.docs.map((d) => format(d, depth + 1)), depth)}${value.truncated ? " …" : ""}`;
    case "docSnapshot":
      return value.exists
        ? `DocumentSnapshot(${value.path}) ${format(value.data, depth)}`
        : `DocumentSnapshot(${value.path}) <does not exist>`;
    case "object":
      return `${value.className} ${format(value.value, depth)}`;
    default:
      return null;
  }
}

export function format(value, depth = 0, topLevel = false) {
  if (value === null) return "null";
  if (typeof value === "string") return topLevel ? value : JSON.stringify(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return join("[", "]", value.map((item) => format(item, depth + 1)), depth);
  if (typeof value.$type === "string") {
    const tagged = formatTagged(value, depth);
    if (tagged !== null) return tagged;
  }
  return join("{", "}", Object.entries(value).map(([key, item]) => `${formatKey(key)}: ${format(item, depth + 1)}`), depth);
}

/** Formats one console entry's arguments the way console.log joins them. */
export function formatArgs(args = []) {
  return args.map((arg) => format(arg, 0, true)).join(" ");
}

export function formatCell(value) {
  if (value === undefined) return "";
  return format(value, 0, true);
}

/** Plain-text rendering of a whole run, used for "copy output". */
export function entriesToText(entries = []) {
  return entries
    .map((entry) => {
      if (entry.level === "table") {
        const header = entry.columns.join("\t");
        const rows = entry.rows.map((row) => entry.columns.map((column) => formatCell(row[column])).join("\t"));
        return [header, ...rows].join("\n");
      }
      if (entry.level === "clear") return "";
      return `[${entry.level}] ${formatArgs(entry.args)}`;
    })
    .join("\n");
}
