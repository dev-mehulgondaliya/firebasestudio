import { StudioShell } from "@/components/studio-shell";

export default function NewConnectionPage() {
  return (
    <StudioShell
      title="Add Firebase project"
      subtitle="Create a secure Firebase connection using either the Web SDK config or a trusted Admin service account."
    >
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Connection name</span>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none ring-0 placeholder:text-slate-500"
                placeholder="aurora-app"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Project ID</span>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-500"
                placeholder="project-id"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Connection type</span>
              <select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none">
                <option>Firebase Web Config</option>
                <option>Firebase Admin SDK</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="mb-3 text-sm font-medium uppercase tracking-[0.15em] text-slate-400">Config example</div>
            <pre className="overflow-x-auto text-xs leading-6 text-slate-300">
{`const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  appId: "..."
};`}
            </pre>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4">
          <div className="mb-2 text-sm font-medium text-slate-200">Service account JSON (Admin SDK)</div>
          <input type="file" className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-100" />
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200">
            Cancel
          </button>
          <button className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white">
            Save connection
          </button>
        </div>
      </div>
    </StudioShell>
  );
}
