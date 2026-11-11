"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { entriesToText, format, formatArgs, formatCell } from "@/lib/execution/output-formatter";
import { Badge, cn, formatDuration, Spinner, STATUS_TONES } from "@/components/ui";

const LEVEL_STYLES = {
  log: "text-slate-200",
  info: "text-sky-300",
  debug: "text-slate-400",
  warn: "text-amber-300 bg-amber-500/5",
  error: "text-rose-300 bg-rose-500/5",
  system: "text-slate-500 italic",
};

function ConsoleTable({ entry }) {
  return (
    <div className="my-1 overflow-x-auto rounded-md border border-slate-800">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            {entry.columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-2 py-1 text-left font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {entry.rows.map((row, index) => (
            <tr key={index}>
              {entry.columns.map((column) => (
                <td key={column} className="max-w-xs truncate whitespace-nowrap px-2 py-1 font-mono text-slate-200" title={formatCell(row[column])}>
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryLine({ entry }) {
  if (entry.level === "table") return <ConsoleTable entry={entry} />;
  return (
    <div className={cn("whitespace-pre-wrap break-words border-b border-slate-900 px-3 py-1 font-mono text-xs leading-5", LEVEL_STYLES[entry.level] || LEVEL_STYLES.log)}>
      {entry.source ? <span className="mr-2 text-slate-600">[{entry.source}]</span> : null}
      {formatArgs(entry.args)}
    </div>
  );
}

function ErrorBlock({ error, onJumpToLine }) {
  return (
    <div className="m-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-rose-200">
        {error.name}: {error.message}
        {error.code ? <Badge tone="red">code {error.code}</Badge> : null}
        {Number.isInteger(error.line) && error.line > 0 ? (
          <button type="button" onClick={() => onJumpToLine?.(error.line)} className="text-xs text-rose-300 underline underline-offset-2 hover:text-white">
            line {error.line}
            {error.column ? `:${error.column}` : ""}
          </button>
        ) : null}
      </div>
      {error.stack && error.stack.includes("\n") ? (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5 text-rose-300/80">{error.stack.split("\n").slice(1).join("\n")}</pre>
      ) : null}
    </div>
  );
}

/**
 * Bottom panel of the playground (also used read-only in history).
 * @param {{ entries: object[], run?: { status, error, result, durationMs, logsTruncated } | null, running?: boolean }} props
 */
export function OutputConsole({ entries = [], run = null, running = false, onClear, onJumpToLine, className, compact = false }) {
  const [tab, setTab] = useState("console");
  const scroller = useRef(null);

  const visible = useMemo(() => {
    const lastClear = entries.map((entry) => entry.level).lastIndexOf("clear");
    return lastClear === -1 ? entries : entries.slice(lastClear + 1);
  }, [entries]);
  const errors = useMemo(() => visible.filter((entry) => entry.level === "error"), [visible]);
  const errorCount = errors.length + (run?.error ? 1 : 0);
  const hasResult = run && run.result !== undefined && run.result !== null;

  useEffect(() => {
    if (run?.status === "error" || run?.status === "timeout") setTab("errors");
    else if (run?.status === "success" && visible.length === 0 && hasResult) setTab("result");
  }, [run, visible.length, hasResult]);

  useEffect(() => {
    if (tab === "console" && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [visible.length, tab]);

  const tabs = [
    { id: "console", label: "Console", count: visible.length || null },
    { id: "errors", label: "Errors", count: errorCount || null, tone: "red" },
    { id: "result", label: "Result", count: hasResult ? 1 : null },
  ];

  async function copy() {
    const text = [entriesToText(visible), run?.error ? `${run.error.name}: ${run.error.message}` : "", hasResult ? `Result: ${format(run.result)}` : ""]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className={cn("flex min-h-0 flex-col bg-slate-950", className)}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-2">
        <div className="flex items-center gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                tab === item.id ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {item.label}
              {item.count ? (
                <span className={cn("rounded px-1 text-[10px]", item.tone === "red" ? "bg-rose-500/20 text-rose-300" : "bg-slate-700 text-slate-300")}>{item.count}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Spinner className="h-3.5 w-3.5" /> Running…
            </span>
          ) : run ? (
            <span className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Badge tone={STATUS_TONES[run.status] || "neutral"}>{run.status}</Badge>
              {formatDuration(run.durationMs)}
            </span>
          ) : null}
          {!compact ? (
            <>
              <button type="button" onClick={copy} className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200" title="Copy output" aria-label="Copy output">
                <Copy className="h-3.5 w-3.5" />
              </button>
              {onClear ? (
                <button type="button" onClick={onClear} className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200" title="Clear console" aria-label="Clear console">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        {tab === "console" ? (
          visible.length ? (
            visible.map((entry, index) => <EntryLine key={index} entry={entry} />)
          ) : (
            <div className="p-3 font-mono text-xs text-slate-600">{running ? "Waiting for output…" : "Output from console.log, console.table and friends appears here. Ctrl/⌘ + Enter runs the script."}</div>
          )
        ) : null}

        {tab === "errors" ? (
          errorCount ? (
            <>
              {run?.error ? <ErrorBlock error={run.error} onJumpToLine={onJumpToLine} /> : null}
              {errors.map((entry, index) => (
                <EntryLine key={index} entry={entry} />
              ))}
            </>
          ) : (
            <div className="p-3 font-mono text-xs text-slate-600">No errors.</div>
          )
        ) : null}

        {tab === "result" ? (
          hasResult ? (
            <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5 text-emerald-200">{format(run.result)}</pre>
          ) : (
            <div className="p-3 font-mono text-xs text-slate-600">The value your script returns (e.g. `return snapshot.size`) is shown here.</div>
          )
        ) : null}

        {run?.logsTruncated ? <div className="px-3 py-2 text-xs text-amber-300">Output was truncated.</div> : null}
      </div>
    </div>
  );
}
