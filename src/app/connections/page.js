import Link from "next/link";
import { StudioShell } from "@/components/studio-shell";

const connections = [
  { name: "aurora-app", type: "Web config", projectId: "aurora-app-prod", status: "Active", lastUsed: "Today" },
  { name: "studio-data", type: "Admin SDK", projectId: "firebase-studio-ops", status: "Secure", lastUsed: "Yesterday" },
  { name: "demo-suite", type: "Web config", projectId: "demo-suite-analytics", status: "Connected", lastUsed: "2 days ago" },
];

export default function ConnectionsPage() {
  return (
    <StudioShell
      title="Connections"
      subtitle="Manage Firebase projects and select the right execution method for browser or server-side workflows."
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-slate-300">3 Firebase projects</div>
        <Link
          href="/connections/new"
          className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Add Firebase project
        </Link>
      </div>

      <div className="grid gap-5">
        {connections.map((connection) => (
          <div key={connection.name} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-white">{connection.name}</h2>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                    {connection.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {connection.type} · {connection.projectId}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Last used: {connection.lastUsed}</span>
                <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                  Manage
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </StudioShell>
  );
}
