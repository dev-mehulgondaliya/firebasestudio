"use client";

import { TYPE_TAGS } from "@/lib/firestore/codec";

const TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
const TAG_KEYS = new Set(TYPE_TAGS.map((tag) => `"${tag}"`));

/** Read-only, syntax-highlighted view of codec-encoded document data. */
export function JsonView({ value }) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  const parts = [];
  let last = 0;
  let match;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    let className = "text-amber-200"; // numbers
    if (token.startsWith('"')) {
      if (match[2]) {
        const key = token.replace(/\s*:$/, "");
        className = TAG_KEYS.has(key) ? "text-orange-400" : "text-sky-300";
      } else {
        className = "text-emerald-300";
      }
    } else if (token === "true" || token === "false") {
      className = "text-violet-300";
    } else if (token === "null") {
      className = "text-slate-500";
    }
    parts.push(
      <span key={match.index} className={className}>
        {token}
      </span>,
    );
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">{parts}</pre>;
}
