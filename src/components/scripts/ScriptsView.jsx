"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileCode2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { toast, useStudioStore } from "@/lib/store/studio-store";
import { Alert, Button, Card, ConfirmDialog, EmptyState, formatRelative, inputClass, PageHeader, Spinner } from "@/components/ui";
import { ModeBadge } from "@/components/editor/EditorToolbar";

export function ScriptsView() {
  const connections = useStudioStore((state) => state.connections);
  const [scripts, setScripts] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api("/api/scripts")
      .then(({ scripts: list }) => setScripts(list))
      .catch((err) => setError(err.message));
  }, []);

  const connectionName = (id) => connections.find((connection) => connection.id === id)?.name;

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!scripts) return [];
    return term ? scripts.filter((script) => script.name.toLowerCase().includes(term) || script.code.toLowerCase().includes(term)) : scripts;
  }, [scripts, filter]);

  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/scripts/${pendingDelete.id}`, { method: "DELETE" });
      setScripts((list) => list.filter((script) => script.id !== pendingDelete.id));
      toast(`Deleted "${pendingDelete.name}".`, "success");
      setPendingDelete(null);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Scripts"
        description="Saved Firebase scripts. Each script remembers the connection (and therefore the execution mode) it was saved with."
        actions={
          <Link href="/playground" className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-500 px-3.5 text-sm font-medium text-white hover:bg-orange-400">
            <Plus className="h-4 w-4" /> New script
          </Link>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {!scripts && !error ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading scripts…
        </div>
      ) : null}

      {scripts && scripts.length === 0 ? (
        <EmptyState icon={FileCode2} title="No saved scripts" description="Write something in the playground and press Ctrl/⌘ + S to save it here." />
      ) : null}

      {scripts && scripts.length > 0 ? (
        <>
          <input className={`${inputClass} mb-3 max-w-sm`} placeholder="Filter by name or code" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <div className="grid gap-3">
            {visible.map((script) => (
              <Card key={script.id} className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/playground?script=${script.id}`} className="truncate font-medium text-white hover:underline">
                        {script.name}
                      </Link>
                      <ModeBadge mode={script.executionMode} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {script.connectionId ? connectionName(script.connectionId) || "Deleted connection" : "No connection"} · updated {formatRelative(script.updatedAt)}
                    </div>
                    <pre className="mt-2 max-h-24 overflow-hidden rounded-md bg-slate-950 p-2 font-mono text-[11px] leading-4 text-slate-400">{script.code.split("\n").slice(0, 6).join("\n")}</pre>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/playground?script=${script.id}`} className="inline-flex h-8 items-center rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-sm text-slate-200 hover:bg-slate-800">
                      Open
                    </Link>
                    <Button size="sm" variant="dangerGhost" icon={Trash2} onClick={() => setPendingDelete(script)} aria-label={`Delete ${script.name}`} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.name}"?`}
        message="The script is removed from Studio. Its past executions stay in history."
        confirmLabel="Delete script"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
