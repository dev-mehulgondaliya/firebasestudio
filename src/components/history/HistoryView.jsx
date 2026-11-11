"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, History, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { toast, useStudioStore } from "@/lib/store/studio-store";
import { OutputConsole } from "@/components/editor/OutputConsole";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, formatDuration, formatRelative, controlClass, PageHeader, Spinner, STATUS_TONES } from "@/components/ui";

function RunDetails({ id }) {
  const [execution, setExecution] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/api/history/${id}`)
      .then(({ execution: data }) => setExecution(data))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!execution) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Spinner /> Loading run…
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Code</span>
          {execution.scriptId ? (
            <Link href={`/playground?script=${execution.scriptId}`} className="text-sky-300 hover:underline">
              Open script
            </Link>
          ) : null}
        </div>
        <pre className="max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">{execution.code}</pre>
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-xs text-slate-500">Output{execution.output === null ? " (not stored — see Settings)" : execution.outputTruncated ? " (truncated)" : ""}</div>
        <OutputConsole
          compact
          className="h-80 rounded-lg border border-slate-800"
          entries={execution.output || []}
          run={{ status: execution.status, error: execution.error, result: execution.result, durationMs: execution.durationMs }}
        />
      </div>
    </div>
  );
}

export function HistoryView() {
  const connections = useStudioStore((state) => state.connections);
  const [connectionId, setConnectionId] = useState("");
  const [executions, setExecutions] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { executions: list } = await api("/api/history", { query: { connectionId, limit: 200 } });
      setExecutions(list);
    } catch (err) {
      setError(err.message);
    }
  }, [connectionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function clear() {
    setClearing(true);
    try {
      const { removed } = await api("/api/history", { method: "DELETE" });
      toast(`Cleared ${removed} executions.`, "success");
      setConfirmClear(false);
      setExpanded(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Execution history"
        description="Every browser and server run, newest first. Output is stored truncated, with private keys redacted."
        actions={
          <>
            <select className={`${controlClass} h-9 w-56 py-1`} value={connectionId} onChange={(event) => setConnectionId(event.target.value)} aria-label="Filter by connection">
              <option value="">All connections</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name}
                </option>
              ))}
            </select>
            <Button icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
            <Button variant="dangerGhost" icon={Trash2} onClick={() => setConfirmClear(true)} disabled={!executions?.length}>
              Clear
            </Button>
          </>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {!executions && !error ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading history…
        </div>
      ) : null}
      {executions && executions.length === 0 ? <EmptyState icon={History} title="No executions yet" description="Runs from the playground appear here." /> : null}

      {executions && executions.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 text-xs text-slate-400">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Connection</th>
                <th className="px-3 py-2 text-left font-medium">Mode</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Duration</th>
                <th className="px-3 py-2 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {executions.map((run) => (
                <Fragment key={run.id}>
                  <tr className="cursor-pointer hover:bg-slate-900/60" onClick={() => setExpanded((current) => (current === run.id ? null : run.id))}>
                    <td className="px-3 py-2 text-slate-500">{expanded === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-slate-300">
                      {run.codePreview.split("\n").find((line) => line.trim() && !line.trim().startsWith("//")) || "(empty)"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">{run.connectionName || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Badge tone={run.executionMode === "server" ? "violet" : "blue"}>{run.executionMode}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Badge tone={STATUS_TONES[run.status] || "neutral"}>{run.status}</Badge>
                      {run.error?.message ? <span className="ml-2 inline-block max-w-[14rem] truncate align-middle text-xs text-rose-300/80" title={run.error.message}>{run.error.message}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{formatDuration(run.durationMs)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400" title={new Date(run.createdAt).toLocaleString()}>
                      {formatRelative(run.createdAt)}
                    </td>
                  </tr>
                  {expanded === run.id ? (
                    <tr>
                      <td colSpan={7} className="bg-slate-950 p-3">
                        <RunDetails id={run.id} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmClear}
        title="Clear execution history?"
        message="All recorded runs, including stored output, will be permanently deleted. Saved scripts are not affected."
        confirmLabel="Clear history"
        busy={clearing}
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
