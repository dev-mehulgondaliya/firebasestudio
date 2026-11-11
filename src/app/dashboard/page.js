import { StudioShell } from "@/components/studio-shell";

const stats = [
  { label: "Connected projects", value: "05", detail: "+2 this month" },
  { label: "Collections", value: "18", detail: "Across 3 databases" },
  { label: "Executions", value: "128", detail: "96% success rate" },
  { label: "Audit logs", value: "357", detail: "Protected and signed" },
];

const activity = [
  { title: "Updated student sync script", time: "2 hours ago", status: "Saved" },
  { title: "Firestore query succeeded", time: "Today, 09:14", status: "Success" },
  { title: "Admin connection verified", time: "Yesterday", status: "Verified" },
  { title: "New collection index added", time: "2 days ago", status: "Healthy" },
];

export default function DashboardPage() {
  return (
    <StudioShell
      title="Dashboard"
      subtitle="Monitor your Firebase workspace, recent activity, and execution health across browser and server-side environments."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="text-sm text-slate-400">{stat.label}</div>
            <div className="mt-3 text-3xl font-bold text-white">{stat.value}</div>
            <div className="mt-2 text-xs text-emerald-300">{stat.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Recent activity</h2>
            <button className="text-sm text-sky-300">View all</button>
          </div>
          <div className="space-y-4">
            {activity.map((item) => (
              <div key={item.title} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                <div>
                  <div className="font-medium text-slate-100">{item.title}</div>
                  <div className="text-sm text-slate-400">{item.time}</div>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold text-white">Workspace health</h2>
          <div className="mt-6 space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm text-slate-300">
                <span>Security rules</span>
                <span>92%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-800">
                <div className="h-2.5 w-[92%] rounded-full bg-emerald-500" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm text-slate-300">
                <span>Firestore sync</span>
                <span>86%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-800">
                <div className="h-2.5 w-[86%] rounded-full bg-sky-500" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm text-slate-300">
                <span>Execution sandbox</span>
                <span>98%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-800">
                <div className="h-2.5 w-[98%] rounded-full bg-violet-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
