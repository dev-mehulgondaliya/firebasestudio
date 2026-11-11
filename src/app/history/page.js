import { StudioShell } from "@/components/studio-shell";

const runs = [
  { id: "run_2048", script: "students/status-sync", status: "Success", time: "09:14 AM", duration: "223ms" },
  { id: "run_2047", script: "backup/export-users", status: "Success", time: "Yesterday", duration: "1.4s" },
  { id: "run_2046", script: "usage/dashboard-metrics", status: "Warning", time: "Last week", duration: "840ms" },
  { id: "run_2045", script: "security/audit-logs", status: "Failed", time: "2 weeks ago", duration: "420ms" },
];

export default function HistoryPage() {
  return (
    <StudioShell title="Execution history" subtitle="Review script runs, successful queries and failed operations across your connected Firebase projects.">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950 text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">Run ID</th>
              <th className="px-4 py-3 text-left">Script</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900 text-slate-200">
            {runs.map((run) => (
              <tr key={run.id}>
                <td className="px-4 py-3">{run.id}</td>
                <td className="px-4 py-3">{run.script}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-1 text-xs ${
                      run.status === "Success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : run.status === "Warning"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3">{run.time}</td>
                <td className="px-4 py-3">{run.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StudioShell>
  );
}
