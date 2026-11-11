import { StudioShell } from "@/components/studio-shell";

const savedScripts = ["students/status-sync", "backup/export-users", "usage/dashboard-metrics"];
const collections = ["students", "attendance", "courses", "settings"];

export default function PlaygroundPage() {
  return (
    <StudioShell title="JavaScript playground" subtitle="Write, run and debug Firebase scripts in browser or Admin execution modes with protected output and error tracing.">
      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-4 text-sm uppercase tracking-[0.18em] text-slate-400">Project</div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white">aurora-app</div>

          <div className="mt-6">
            <div className="mb-3 text-sm uppercase tracking-[0.18em] text-slate-400">Collections</div>
            <div className="space-y-2">
              {collections.map((collection) => (
                <div key={collection} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                  {collection}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-sm uppercase tracking-[0.18em] text-slate-400">Saved scripts</div>
            <div className="space-y-2">
              {savedScripts.map((script) => (
                <div key={script} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                  {script}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">aurora-app</button>
                <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">Browser mode</button>
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">Save</button>
                <button className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white">
                  Run script
                </button>
              </div>
            </div>

            <textarea
              className="h-[320px] w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none"
              defaultValue={`const snapshot = await db.collection("students").get();

snapshot.forEach((doc) => {
  console.log(doc.id, doc.data());
});

console.table(
  snapshot.docs.map((doc) => ({
    id: doc.id,
    status: doc.data().status,
  }))
);`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-3 text-lg font-semibold text-white">Console</div>
              <pre className="min-h-[180px] rounded-xl bg-slate-950 p-4 text-sm leading-6 text-emerald-300">
{`[INFO] Connected to Firestore\n[INFO] Fetched 3 documents\n[LOG] STUDENT_102 active\n[LOG] STUDENT_203 pending`}
              </pre>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-3 text-lg font-semibold text-white">Errors</div>
              <pre className="min-h-[180px] rounded-xl bg-slate-950 p-4 text-sm leading-6 text-rose-300">
{`No errors\nExecution completed in 223ms`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
