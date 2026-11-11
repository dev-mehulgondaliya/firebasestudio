import Link from "next/link";
import { Code2, Database, FileCode2, History, PlugZap, Plus, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/security/permissions";
import { getOverview } from "@/lib/studio-db";
import { Badge, PageHeader } from "@/components/ui";
import { ConnectionTypeBadge } from "@/components/layout/ConnectionPicker";

export const metadata = { title: "Dashboard · Firebase Studio" };
export const dynamic = "force-dynamic";

const STATUS_TONE = { success: "green", error: "red", timeout: "amber" };

function relative(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

function Stat({ label, value, detail, icon: Icon, href }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-700">
      <div className="flex items-center justify-between text-sm text-slate-400">
        {label}
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </Link>
  );
}

const OPERATION_LABELS = {
  "connection.create": "Connection added",
  "connection.delete": "Connection removed",
  "document.create": "Document created",
  "document.update": "Document updated",
  "document.delete": "Document deleted",
  "document.import": "Documents imported",
  "execution.server": "Admin script executed",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const overview = await getOverview(user.uid);
  const adminCount = overview.connections.filter((c) => c.connectionType === "admin").length;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Dashboard"
        description="Your Firebase workspace at a glance."
        actions={
          <>
            <Link href="/connections/new" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 text-sm text-slate-200 hover:bg-slate-800">
              <Plus className="h-4 w-4" /> Add project
            </Link>
            <Link href="/playground" className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-500 px-3.5 text-sm font-medium text-white hover:bg-orange-400">
              <Code2 className="h-4 w-4" /> Open playground
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Connected projects"
          value={overview.connections.length}
          detail={`${overview.connections.length - adminCount} web · ${adminCount} admin`}
          icon={PlugZap}
          href="/connections"
        />
        <Stat label="Saved scripts" value={overview.scriptCount} detail="Reusable Firebase scripts" icon={FileCode2} href="/scripts" />
        <Stat
          label="Recent executions"
          value={overview.executionCount}
          detail={overview.successRate === null ? "No runs yet" : `${overview.successRate}% succeeded (last ${overview.executionCount})`}
          icon={History}
          href="/history"
        />
        <Stat label="Database explorer" value={<Database className="h-6 w-6 text-orange-400" />} detail="Browse, query and edit documents" icon={Database} href="/database" />
      </div>

      {overview.connections.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-6">
          <h2 className="font-semibold text-white">Get started</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
            <li>
              <Link href="/connections/new" className="text-sky-300 hover:underline">
                Connect a Firebase project
              </Link>{" "}
              with a Web config or a service account.
            </li>
            <li>
              Browse and edit documents in the{" "}
              <Link href="/database" className="text-sky-300 hover:underline">
                Database explorer
              </Link>
              .
            </li>
            <li>
              Write and run JavaScript in the{" "}
              <Link href="/playground" className="text-sky-300 hover:underline">
                Playground
              </Link>
              , then save it as a script.
            </li>
          </ol>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="font-semibold text-white">Recent executions</h2>
            <Link href="/history" className="text-sm text-sky-300 hover:underline">
              View all
            </Link>
          </div>
          {overview.recentExecutions.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No scripts have run yet.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {overview.recentExecutions.map((run) => (
                <li key={run.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-slate-300">{(run.code || "").split("\n").find((line) => line.trim() && !line.trim().startsWith("//")) || "(empty)"}</div>
                    <div className="text-xs text-slate-500">
                      {run.connectionName} · {run.executionMode} · {relative(run.createdAt)}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[run.status] || "neutral"}>{run.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="font-semibold text-white">Projects</h2>
            <Link href="/connections" className="text-sm text-sky-300 hover:underline">
              Manage
            </Link>
          </div>
          {overview.connections.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No projects connected.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {overview.connections.map((connection) => (
                <li key={connection.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-200">{connection.name}</div>
                    <div className="truncate font-mono text-xs text-slate-500">{connection.projectId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connection.lastTestStatus ? (
                      <Badge tone={connection.lastTestStatus === "ok" ? "green" : "red"}>{connection.lastTestStatus === "ok" ? "healthy" : "failing"}</Badge>
                    ) : null}
                    <ConnectionTypeBadge type={connection.connectionType} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-slate-800 px-4 py-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Audit trail
            </h3>
            {overview.auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No audited operations yet.</p>
            ) : (
              <ul className="space-y-1">
                {overview.auditLogs.map((log) => (
                  <li key={log.id} className="flex justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-slate-400">
                      {OPERATION_LABELS[log.operation] || log.operation}
                      {log.resource ? <span className="ml-1 font-mono text-slate-500">{log.resource}</span> : null}
                    </span>
                    <span className="shrink-0 text-slate-600">{relative(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
