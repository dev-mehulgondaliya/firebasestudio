"use client";

import { Plus, Search, X } from "lucide-react";
import { Button, cn, controlClass } from "@/components/ui";

export const OPERATORS = ["==", "!=", "<", "<=", ">", ">=", "array-contains", "array-contains-any", "in", "not-in"];
const ARRAY_OPERATORS = new Set(["in", "not-in", "array-contains-any"]);
const VALUE_TYPES = ["string", "number", "boolean", "null", "timestamp", "reference", "json"];

export const EMPTY_QUERY = { filters: [], orderBy: "", direction: "asc", limit: 50 };

/** Converts the builder's text inputs into codec-encoded filter values. */
export function encodeFilters(filters) {
  return filters
    .filter((filter) => filter.field.trim())
    .map((filter) => {
      const text = filter.value;
      let value;
      switch (filter.type) {
        case "number":
          value = Number(text);
          if (text.trim() === "" || Number.isNaN(value)) throw new Error(`"${filter.field}": "${text}" is not a number`);
          break;
        case "boolean":
          value = text.trim().toLowerCase() === "true";
          break;
        case "null":
          value = null;
          break;
        case "timestamp":
          value = { $timestamp: text.trim() };
          break;
        case "reference":
          value = { $ref: text.trim() };
          break;
        case "json":
          try {
            value = JSON.parse(text);
          } catch {
            throw new Error(`"${filter.field}": value is not valid JSON`);
          }
          break;
        default:
          value = text;
      }
      return { field: filter.field.trim(), op: filter.op, value };
    });
}

export function QueryBuilder({ query, onChange, onRun, running }) {
  const update = (patch) => onChange({ ...query, ...patch });
  const updateFilter = (index, patch) =>
    update({
      filters: query.filters.map((filter, i) => {
        if (i !== index) return filter;
        const next = { ...filter, ...patch };
        if (patch.op && ARRAY_OPERATORS.has(patch.op) && filter.type !== "json") {
          next.type = "json";
          next.value = next.value ? JSON.stringify(next.value.split(",").map((item) => item.trim())) : "[]";
        }
        return next;
      }),
    });

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      {query.filters.map((filter, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1.5">
          <span className="w-12 text-xs text-slate-500">{index === 0 ? "where" : "and"}</span>
          <input
            className={cn(controlClass, "h-8 w-36 py-1 font-mono text-xs")}
            placeholder="field.path"
            value={filter.field}
            onChange={(event) => updateFilter(index, { field: event.target.value })}
          />
          <select className={cn(controlClass, "h-8 w-auto py-1 text-xs")} value={filter.op} onChange={(event) => updateFilter(index, { op: event.target.value })}>
            {OPERATORS.map((op) => (
              <option key={op}>{op}</option>
            ))}
          </select>
          <select className={cn(controlClass, "h-8 w-auto py-1 text-xs")} value={filter.type} onChange={(event) => updateFilter(index, { type: event.target.value })}>
            {VALUE_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          {filter.type !== "null" ? (
            <input
              className={cn(controlClass, "h-8 min-w-[8rem] flex-1 py-1 font-mono text-xs")}
              placeholder={filter.type === "timestamp" ? "2024-01-01T00:00:00Z" : filter.type === "reference" ? "users/uid" : filter.type === "json" ? '["a","b"]' : "value"}
              value={filter.value}
              onChange={(event) => updateFilter(index, { value: event.target.value })}
            />
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            onClick={() => update({ filters: query.filters.filter((_, i) => i !== index) })}
            aria-label="Remove filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="xs" variant="ghost" icon={Plus} onClick={() => update({ filters: [...query.filters, { field: "", op: "==", type: "string", value: "" }] })}>
          Filter
        </Button>
        <span className="ml-2 text-xs text-slate-500">order by</span>
        <input
          className={cn(controlClass, "h-8 w-32 py-1 font-mono text-xs")}
          placeholder="(document ID)"
          value={query.orderBy}
          onChange={(event) => update({ orderBy: event.target.value })}
        />
        <select className={cn(controlClass, "h-8 w-auto py-1 text-xs")} value={query.direction} onChange={(event) => update({ direction: event.target.value })}>
          <option value="asc">asc</option>
          <option value="desc">desc</option>
        </select>
        <span className="ml-2 text-xs text-slate-500">limit</span>
        <select className={cn(controlClass, "h-8 w-auto py-1 text-xs")} value={query.limit} onChange={(event) => update({ limit: Number(event.target.value) })}>
          {[10, 25, 50, 100, 250, 500].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <Button type="submit" size="xs" variant="primary" icon={Search} loading={running} className="ml-auto">
          Run query
        </Button>
      </div>
      <p className="text-[11px] text-slate-600">
        Use <code>__name__</code> as the field for document IDs. Compound queries may need a composite index; Firestore returns a link to create it.
      </p>
    </form>
  );
}
