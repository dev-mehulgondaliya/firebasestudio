import { StudioShell } from "@/components/studio-shell";

export default function SettingsPage() {
  return (
    <StudioShell title="Settings" subtitle="Control workspace behavior, security defaults and user preferences for Studio and connected Firebase projects.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold text-white">User preferences</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-200">
              <span>Match theme to system</span>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-200">
              <span>Auto-save scripts</span>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-200">
              <span>Confirm document deletes</span>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold text-white">Security</h2>
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="font-medium text-slate-100">Execution isolation</div>
              <div className="mt-1">Browser sandbox + isolated Node.js workers for Admin SDK scripts.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="font-medium text-slate-100">Secret handling</div>
              <div className="mt-1">Private credentials are encrypted before storage and never exposed in editor output.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="font-medium text-slate-100">Audit trail</div>
              <div className="mt-1">Every connection, script and execution is tracked with metadata and timestamps.</div>
            </div>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
