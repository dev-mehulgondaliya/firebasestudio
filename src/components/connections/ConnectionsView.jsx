"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Code2, Database, PlugZap, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { createDatabaseAdapter } from "@/lib/database/adapters";
import { toast, useStudioStore } from "@/lib/store/studio-store";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, formatRelative, PageHeader, Spinner } from "@/components/ui";
import { ConnectionTypeBadge } from "@/components/layout/ConnectionPicker";

function TestStatus({ connection, testing }) {
  if (testing) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-slate-400">
        <Spinner className="h-3.5 w-3.5" /> Testing…
      </span>
    );
  }
  if (!connection.lastTestedAt) return <Badge>Not tested</Badge>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={connection.lastTestStatus === "ok" ? "green" : "red"}>{connection.lastTestStatus === "ok" ? "Healthy" : "Failed"}</Badge>
      <span className="text-xs text-slate-500">tested {formatRelative(connection.lastTestedAt)}</span>
    </span>
  );
}

export function ConnectionsView() {
  const router = useRouter();
  const params = useSearchParams();
  const connections = useStudioStore((state) => state.connections);
  const status = useStudioStore((state) => state.connectionsStatus);
  const loadError = useStudioStore((state) => state.connectionsError);
  const loadConnections = useStudioStore((state) => state.loadConnections);
  const setActive = useStudioStore((state) => state.setActiveConnectionId);

  const [testing, setTesting] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const autoTested = useRef(false);

  async function test(connection) {
    setTesting((state) => ({ ...state, [connection.id]: true }));
    try {
      const result = await createDatabaseAdapter(connection).test();
      toast(`${connection.name}: ${result.message}`, result.ok ? "success" : "error");
    } catch (error) {
      toast(`${connection.name}: ${error.message}`, "error");
    } finally {
      setTesting((state) => ({ ...state, [connection.id]: false }));
      loadConnections({ force: true });
    }
  }

  // Test a freshly created connection automatically.
  useEffect(() => {
    const id = params.get("test");
    if (!id || autoTested.current || status !== "ready") return;
    const connection = connections.find((item) => item.id === id);
    if (!connection) return;
    autoTested.current = true;
    router.replace("/connections");
    test(connection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, status, connections]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api(`/api/connections/${pendingDelete.id}`, { method: "DELETE" });
      toast(`Removed "${pendingDelete.name}".`, "success");
      setPendingDelete(null);
      await loadConnections({ force: true });
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setDeleting(false);
    }
  }

  function open(connection, href) {
    setActive(connection.id);
    router.push(href);
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Connections"
        description="Firebase projects Studio can reach. Web config connections run in your browser; Admin connections run on the server."
        actions={
          <>
            <Button icon={RefreshCw} onClick={() => loadConnections({ force: true })} loading={status === "loading"}>
              Refresh
            </Button>
            <Link href="/connections/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-500 px-3.5 text-sm font-medium text-white hover:bg-orange-400">
              <Plus className="h-4 w-4" /> Add Firebase project
            </Link>
          </>
        }
      />

      {loadError ? <Alert tone="error" className="mb-4">{loadError}</Alert> : null}

      {status === "ready" && connections.length === 0 ? (
        <EmptyState
          icon={PlugZap}
          title="No Firebase projects yet"
          description="Add a Web config to browse data with your Security Rules, or a service account for full Admin SDK access."
          action={
            <Link href="/connections/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-500 px-3.5 text-sm font-medium text-white hover:bg-orange-400">
              <Plus className="h-4 w-4" /> Add Firebase project
            </Link>
          }
        />
      ) : null}

      {status !== "ready" && connections.length === 0 && !loadError ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading connections…
        </div>
      ) : null}

      <div className="grid gap-3">
        {connections.map((connection) => (
          <Card key={connection.id} className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-white">{connection.name}</h2>
                  <ConnectionTypeBadge type={connection.connectionType} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span>
                    Project <span className="font-mono text-slate-300">{connection.projectId}</span>
                  </span>
                  {connection.clientEmail ? <span className="truncate font-mono text-xs leading-5 text-slate-500">{connection.clientEmail}</span> : null}
                  <span className="text-slate-500">added {formatRelative(connection.createdAt)}</span>
                </div>
                <div className="mt-2">
                  <TestStatus connection={connection} testing={testing[connection.id]} />
                </div>
                {connection.lastTestStatus === "failed" && connection.lastTestMessage && !testing[connection.id] ? (
                  <p className="mt-2 max-w-3xl break-words text-xs text-rose-300/90">{connection.lastTestMessage}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={PlugZap} onClick={() => test(connection)} loading={testing[connection.id]}>
                  Test
                </Button>
                <Button size="sm" icon={Database} onClick={() => open(connection, "/database")}>
                  Explore
                </Button>
                <Button size="sm" icon={Code2} onClick={() => open(connection, "/playground")}>
                  Playground
                </Button>
                <Button size="sm" variant="dangerGhost" icon={Trash2} onClick={() => setPendingDelete(connection)} aria-label={`Delete ${connection.name}`}>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.name}"?`}
        message={
          <>
            Studio will forget this connection{pendingDelete?.connectionType === "admin" ? " and destroy its encrypted service account key" : ""}. Nothing in
            the Firebase project itself is changed. Saved scripts stay, but must be pointed at another connection.
          </>
        }
        confirmLabel="Delete connection"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
