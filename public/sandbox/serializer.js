/*
 * Firebase Studio output serializer.
 *
 * Converts arbitrary values passed to console.* (or returned by a script) into
 * JSON-safe "display values" that the Studio console can render. Shared by:
 *   - the browser sandbox worker (loaded with importScripts)
 *   - the Node.js execution worker (loaded with require)
 * so it must stay dependency-free plain JavaScript.
 *
 * Special values become objects with a "$type" key, e.g.
 *   { "$type": "timestamp", "value": "2024-01-01T00:00:00.000000000Z" }
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StudioSerializer = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_DEPTH = 8;
  var MAX_ITEMS = 200;
  var MAX_KEYS = 200;
  var MAX_STRING = 20000;
  var MAX_DOCS = 100;

  function pad(value, size) {
    var text = String(value);
    while (text.length < size) text = "0" + text;
    return text;
  }

  function timestampToIso(seconds, nanoseconds) {
    var base = new Date(seconds * 1000).toISOString().slice(0, 19);
    return base + "." + pad(nanoseconds, 9) + "Z";
  }

  function ctorName(value) {
    try {
      return (value && value.constructor && value.constructor.name) || "";
    } catch (e) {
      return "";
    }
  }

  function isTimestamp(v) {
    return typeof v.toDate === "function" && typeof v.seconds === "number" && typeof v.nanoseconds === "number";
  }

  function isGeoPoint(v) {
    return typeof v.latitude === "number" && typeof v.longitude === "number" && typeof v.isEqual === "function";
  }

  function isDocumentReference(v) {
    return typeof v.path === "string" && typeof v.id === "string" && v.parent && typeof v.collection === "function";
  }

  function isCollectionReference(v) {
    return typeof v.path === "string" && typeof v.id === "string" && typeof v.doc === "function";
  }

  function isQuerySnapshot(v) {
    return Array.isArray(v.docs) && typeof v.size === "number" && typeof v.forEach === "function";
  }

  function isDocumentSnapshot(v) {
    return typeof v.id === "string" && typeof v.data === "function" && v.ref && typeof v.ref.path === "string";
  }

  function isBytesLike(v) {
    return typeof v.toBase64 === "function" && typeof v.toUint8Array === "function";
  }

  function isVector(v) {
    return ctorName(v) === "VectorValue" && typeof v.toArray === "function";
  }

  function bytesPreview(bytes) {
    var length = bytes.length;
    var hex = [];
    for (var i = 0; i < Math.min(length, 32); i += 1) hex.push(pad(bytes[i].toString(16), 2));
    return { $type: "bytes", length: length, preview: hex.join(" ") + (length > 32 ? " …" : "") };
  }

  function truncateString(text) {
    return text.length > MAX_STRING ? text.slice(0, MAX_STRING) + "… (" + (text.length - MAX_STRING) + " more characters)" : text;
  }

  function serializeError(error, lineOffset) {
    var out = {
      $type: "error",
      name: String((error && error.name) || "Error"),
      message: String((error && error.message) || error),
    };
    if (error && error.code !== undefined) out.code = String(error.code);
    if (error && typeof error.stack === "string") {
      var stack = error.stack;
      if (typeof lineOffset === "number") {
        // Map positions inside the user's script ("<anonymous>:LINE:COL") to
        // editor lines and hide the runtime's internal frames.
        var frames = [];
        var pattern = /<anonymous>:(\d+):(\d+)/;
        stack.split("\n").forEach(function (line) {
          var frame = pattern.exec(line);
          if (!frame) return;
          var userLine = Number(frame[1]) - lineOffset;
          if (out.line === undefined) {
            out.line = userLine;
            out.column = Number(frame[2]);
          }
          frames.push("    at script:" + userLine + ":" + frame[2]);
        });
        stack = out.name + ": " + out.message + (frames.length ? "\n" + frames.join("\n") : "");
      }
      out.stack = truncateString(stack);
    }
    return out;
  }

  function serialize(value, depth, ancestors) {
    var type = typeof value;
    if (value === null) return null;
    if (type === "undefined") return { $type: "undefined" };
    if (type === "string") return truncateString(value);
    if (type === "boolean") return value;
    if (type === "number") return isFinite(value) ? value : { $type: "number", value: String(value) };
    if (type === "bigint") return { $type: "bigint", value: value.toString() };
    if (type === "symbol") return { $type: "symbol", value: value.toString() };
    if (type === "function") return { $type: "function", name: value.name || "anonymous" };

    if (ancestors.indexOf(value) !== -1) return { $type: "circular" };
    if (depth > MAX_DEPTH) return { $type: "truncated", preview: Array.isArray(value) ? "[Array]" : "[" + (ctorName(value) || "Object") + "]" };

    ancestors.push(value);
    try {
      if (value instanceof Error) return serializeError(value);
      if (value instanceof Date) return { $type: "date", value: isNaN(value.getTime()) ? "Invalid Date" : value.toISOString() };
      if (typeof Promise !== "undefined" && value instanceof Promise) return { $type: "promise" };
      if (isTimestamp(value)) return { $type: "timestamp", value: timestampToIso(value.seconds, value.nanoseconds) };
      if (isGeoPoint(value)) return { $type: "geopoint", latitude: value.latitude, longitude: value.longitude };
      if (isQuerySnapshot(value)) {
        var docs = value.docs.slice(0, MAX_DOCS).map(function (doc) {
          return serialize(doc, depth + 1, ancestors);
        });
        return { $type: "querySnapshot", size: value.size, docs: docs, truncated: value.docs.length > MAX_DOCS };
      }
      if (isDocumentSnapshot(value)) {
        var exists = typeof value.exists === "function" ? value.exists() : Boolean(value.exists);
        return {
          $type: "docSnapshot",
          id: value.id,
          path: value.ref.path,
          exists: exists,
          data: exists ? serialize(value.data(), depth + 1, ancestors) : null,
        };
      }
      if (isDocumentReference(value)) return { $type: "ref", path: value.path };
      if (isCollectionReference(value)) return { $type: "collectionRef", path: value.path };
      if (isVector(value)) return { $type: "vector", values: value.toArray() };
      if (isBytesLike(value)) return bytesPreview(value.toUint8Array());
      if (typeof Uint8Array !== "undefined" && value instanceof Uint8Array) return bytesPreview(value);
      if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return bytesPreview(new Uint8Array(value));

      if (typeof Map !== "undefined" && value instanceof Map) {
        var entries = [];
        value.forEach(function (v, k) {
          if (entries.length < MAX_ITEMS) entries.push([serialize(k, depth + 1, ancestors), serialize(v, depth + 1, ancestors)]);
        });
        return { $type: "map", size: value.size, entries: entries };
      }
      if (typeof Set !== "undefined" && value instanceof Set) {
        var values = [];
        value.forEach(function (v) {
          if (values.length < MAX_ITEMS) values.push(serialize(v, depth + 1, ancestors));
        });
        return { $type: "set", size: value.size, values: values };
      }

      if (Array.isArray(value)) {
        var items = [];
        for (var i = 0; i < Math.min(value.length, MAX_ITEMS); i += 1) items.push(serialize(value[i], depth + 1, ancestors));
        if (value.length > MAX_ITEMS) items.push({ $type: "more", count: value.length - MAX_ITEMS });
        return items;
      }

      var out = {};
      var keys = Object.keys(value);
      for (var k = 0; k < Math.min(keys.length, MAX_KEYS); k += 1) {
        var key = keys[k];
        var item;
        try {
          item = value[key];
        } catch (e) {
          item = "[getter threw: " + (e && e.message) + "]";
        }
        out[key] = serialize(item, depth + 1, ancestors);
      }
      if (keys.length > MAX_KEYS) out["…"] = { $type: "more", count: keys.length - MAX_KEYS };
      var name = ctorName(value);
      if (name && name !== "Object") return { $type: "object", className: name, value: out };
      return out;
    } finally {
      ancestors.pop();
    }
  }

  function serializeValue(value) {
    return serialize(value, 0, []);
  }

  function serializeArgs(args) {
    var out = [];
    for (var i = 0; i < args.length; i += 1) out.push(serializeValue(args[i]));
    return out;
  }

  /** Normalises console.table input into { columns, rows } of display values. */
  function tableData(data, columns) {
    var entries = [];
    if (data && isQuerySnapshot(data)) {
      data.docs.slice(0, MAX_ITEMS).forEach(function (doc) {
        var row = { id: doc.id };
        var fields = doc.data() || {};
        Object.keys(fields).forEach(function (key) {
          row[key] = fields[key];
        });
        entries.push([doc.id, row]);
      });
    } else if (Array.isArray(data)) {
      data.slice(0, MAX_ITEMS).forEach(function (row, index) {
        entries.push([index, row]);
      });
    } else if (data && typeof data === "object") {
      Object.keys(data).slice(0, MAX_ITEMS).forEach(function (key) {
        entries.push([key, data[key]]);
      });
    } else {
      return null;
    }

    var columnOrder = [];
    var seen = {};
    var rows = entries.map(function (entry) {
      var source = entry[1];
      var row = { "(index)": String(entry[0]) };
      if (source !== null && typeof source === "object" && !Array.isArray(source) && !isTimestamp(source)) {
        Object.keys(source).forEach(function (key) {
          if (columns && columns.indexOf(key) === -1) return;
          if (!seen[key]) {
            seen[key] = true;
            columnOrder.push(key);
          }
          row[key] = serialize(source[key], 1, []);
        });
      } else {
        if (!seen.Values) {
          seen.Values = true;
          columnOrder.push("Values");
        }
        row.Values = serialize(source, 1, []);
      }
      return row;
    });
    return { columns: ["(index)"].concat(columnOrder.slice(0, 50)), rows: rows };
  }

  /** Builds a console object whose output is forwarded through `emit(entry)`. */
  function createConsole(emit, lineOffset) {
    var counters = {};
    var timers = {};
    function write(level) {
      return function () {
        emit({ level: level, args: serializeArgs(Array.prototype.slice.call(arguments)), ts: Date.now() });
      };
    }
    return {
      log: write("log"),
      info: write("info"),
      warn: write("warn"),
      error: write("error"),
      debug: write("debug"),
      trace: write("log"),
      dir: function (value) {
        emit({ level: "log", args: [serializeValue(value)], ts: Date.now() });
      },
      table: function (data, columns) {
        var table = tableData(data, Array.isArray(columns) ? columns : null);
        if (!table) emit({ level: "log", args: serializeArgs([data]), ts: Date.now() });
        else emit({ level: "table", columns: table.columns, rows: table.rows, ts: Date.now() });
      },
      assert: function (condition) {
        if (condition) return;
        var rest = Array.prototype.slice.call(arguments, 1);
        emit({ level: "error", args: serializeArgs(["Assertion failed:"].concat(rest)), ts: Date.now() });
      },
      count: function (label) {
        var key = label === undefined ? "default" : String(label);
        counters[key] = (counters[key] || 0) + 1;
        emit({ level: "log", args: [key + ": " + counters[key]], ts: Date.now() });
      },
      time: function (label) {
        timers[label === undefined ? "default" : String(label)] = Date.now();
      },
      timeEnd: function (label) {
        var key = label === undefined ? "default" : String(label);
        if (timers[key] === undefined) return;
        emit({ level: "log", args: [key + ": " + (Date.now() - timers[key]) + "ms"], ts: Date.now() });
        delete timers[key];
      },
      group: write("log"),
      groupEnd: function () {},
      clear: function () {
        emit({ level: "clear", ts: Date.now() });
      },
      __errorToEntry: function (error) {
        return serializeError(error, lineOffset);
      },
    };
  }

  return {
    serialize: serializeValue,
    serializeArgs: serializeArgs,
    serializeError: serializeError,
    createConsole: createConsole,
    timestampToIso: timestampToIso,
  };
});
