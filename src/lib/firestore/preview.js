// Short, single-line previews of codec-encoded Firestore values for tables.

export function previewValue(value, max = 60) {
  const text = render(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function render(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.length}]`;
  const keys = Object.keys(value);
  if (keys.length === 1) {
    const payload = value[keys[0]];
    switch (keys[0]) {
      case "$timestamp":
        return String(payload).replace("T", " ").replace(/\.(\d{3})\d*Z$/, ".$1Z");
      case "$geopoint":
        return `(${payload?.latitude}, ${payload?.longitude})`;
      case "$ref":
        return `→ ${payload}`;
      case "$bytes":
        return `bytes(${Math.floor((String(payload).length * 3) / 4)})`;
      case "$vector":
        return `vector(${payload?.length ?? 0})`;
      case "$number":
        return String(payload);
      default:
        break;
    }
  }
  return `{${keys.length}}`;
}

/** Field type label shown next to values. */
export function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0].startsWith("$") && keys[0] !== "$map") return keys[0].slice(1);
    return "map";
  }
  return typeof value;
}

/** Picks the most common top-level fields across documents for table columns. */
export function pickColumns(documents, count = 5) {
  const frequency = new Map();
  for (const doc of documents.slice(0, 100)) {
    for (const key of Object.keys(doc.data || {})) frequency.set(key, (frequency.get(key) || 0) + 1);
  }
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([key]) => key);
}
