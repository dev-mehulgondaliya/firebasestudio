import { StudioShell } from "@/components/studio-shell";

const scripts = [
  { name: "students/status-sync", mode: "Browser mode", updated: "2 hours ago" },
  { name: "backup/export-users", mode: "Admin SDK", updated: "Today" },
  { name: "usage/dashboard-metrics", mode: "Browser mode", updated: "Yesterday" },
  { name: "security/audit-logs", mode: "Admin SDK", updated: "3 days ago" },
];

export default function ScriptsPage() {
  return (
    <StudioShell title="Scripts" subtitle="Keep your reusable Firebase scripts organized, versioned and ready to run across browser and server contexts.">
      <div className="grid gap-5">
        {scripts.map((script) => (
          <div key={script.name} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xl font-semibold text-white">{script.name}</div>
                <div className="mt-1 text-sm text-slate-400">Last updated {script.updated}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200">
                  {script.mode}
                </span>
                <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">Open</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </StudioShell>
  );
}
