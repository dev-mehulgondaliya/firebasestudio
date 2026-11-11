"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/studio-store";
import { Alert, Card, cn, controlClass, PageHeader, Spinner } from "@/components/ui";

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
      <span>
        <span className="block text-sm text-slate-100">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-slate-500">{description}</span> : null}
      </span>
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-orange-500" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Check({ ok, label, detail }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ok ? "text-emerald-400" : "text-amber-400")} />
      <div className="min-w-0">
        <div className="text-sm text-slate-100">{label}</div>
        <div className="mt-0.5 break-words text-xs text-slate-500">{detail}</div>
      </div>
    </div>
  );
}

export function SettingsView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/settings")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  async function update(patch) {
    const previous = data.settings;
    setData((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
    try {
      const { settings } = await api("/api/settings", { method: "PUT", body: patch });
      setData((current) => ({ ...current, settings }));
      toast("Settings saved.", "success");
    } catch (err) {
      setData((current) => ({ ...current, settings: previous }));
      toast(err.message, "error");
    }
  }

  if (error) return <div className="p-6"><Alert tone="error">{error}</Alert></div>;
  if (!data) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
        <Spinner /> Loading settings…
      </div>
    );
  }

  const { settings, environment, user } = data;

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Settings" description={`Signed in as ${user.email || user.uid}.`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold text-white">Preferences</h2>
          <Toggle
            label="Store script output in history"
            description="Keeps up to 32 KB of console output per run, with private keys redacted. Turn off if scripts print sensitive data."
            checked={settings.storeOutputInHistory}
            onChange={(value) => update({ storeOutputInHistory: value })}
          />
          <Toggle
            label="Confirm before deleting documents"
            description="Ask for confirmation in the Database explorer."
            checked={settings.confirmDeletes}
            onChange={(value) => update({ confirmDeletes: value })}
          />
          <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <span>
              <span className="block text-sm text-slate-100">Default execution timeout</span>
              <span className="mt-0.5 block text-xs text-slate-500">Scripts are terminated after this long (1–120 seconds).</span>
            </span>
            <select
              className={`${controlClass} w-24 py-1`}
              value={settings.defaultTimeoutSeconds}
              onChange={(event) => update({ defaultTimeoutSeconds: Number(event.target.value) })}
            >
              {[10, 30, 60, 120].map((value) => (
                <option key={value} value={value}>
                  {value}s
                </option>
              ))}
            </select>
          </label>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-semibold text-white">Environment &amp; security</h2>
          <Check
            ok
            label={`Studio data: ${environment.storage === "firestore" ? "separate Firestore project" : "local JSON file"}`}
            detail={
              environment.storage === "firestore"
                ? environment.storageLocation
                : `${environment.storageLocation} — fine for local use. Set STUDIO_FIREBASE_SERVICE_ACCOUNT to use a dedicated Firestore project.`
            }
          />
          <Check
            ok={environment.encryptionConfigured}
            label="Credential encryption"
            detail={environment.encryptionConfigured ? "Service accounts are encrypted with AES-256-GCM (STUDIO_ENCRYPTION_KEY)." : "STUDIO_ENCRYPTION_KEY is missing: Admin connections cannot be saved."}
          />
          <Check
            ok={environment.serverExecutionEnabled}
            label={`Server execution ${environment.serverExecutionEnabled ? "enabled" : "disabled"}`}
            detail="Admin SDK scripts run in a separate Node.js process per execution, never inside the Next.js server. Toggle with STUDIO_SERVER_EXECUTION."
          />
          <Check
            ok={environment.workerPermissionModel}
            label="Worker permission model"
            detail={
              environment.workerPermissionModel
                ? `Node ${environment.nodeVersion}: workers cannot write files, read outside node_modules, or spawn processes.`
                : `Node ${environment.nodeVersion} has no --permission flag. Upgrade to Node 22+ for file-system and process isolation.`
            }
          />
          <Check ok label="Browser sandbox" detail="Web SDK scripts run in an opaque-origin iframe + Web Worker with no access to Studio cookies or storage." />
        </Card>
      </div>
    </div>
  );
}
