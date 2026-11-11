"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileJson, Globe, KeyRound, Upload } from "lucide-react";
import { api } from "@/lib/api/client";
import { parseWebConfigInput } from "@/lib/firebase/client";
import { toast, useStudioStore } from "@/lib/store/studio-store";
import { Alert, Button, Card, cn, Field, inputClass } from "@/components/ui";

const WEB_PLACEHOLDER = `const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "my-app.firebaseapp.com",
  projectId: "my-app",
  appId: "1:123:web:abc"
};`;

function TypeOption({ active, icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-start gap-3 rounded-xl border p-4 text-left transition",
        active ? "border-orange-400/60 bg-orange-500/10" : "border-slate-800 bg-slate-950 hover:border-slate-700",
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", active ? "text-orange-300" : "text-slate-500")} />
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
      </div>
    </button>
  );
}

function parseServiceAccount(text) {
  if (!text.trim()) return { value: null, error: null };
  try {
    const value = JSON.parse(text);
    if (value.type !== "service_account") return { value: null, error: 'This JSON is not a service account key (type must be "service_account").' };
    if (!value.private_key || !value.client_email || !value.project_id) return { value: null, error: "The key is missing project_id, client_email or private_key." };
    return { value, error: null };
  } catch {
    return { value: null, error: "Not valid JSON." };
  }
}

export function ConnectionForm() {
  const router = useRouter();
  const loadConnections = useStudioStore((state) => state.loadConnections);
  const setActive = useStudioStore((state) => state.setActiveConnectionId);
  const fileInput = useRef(null);

  const [type, setType] = useState("web");
  const [name, setName] = useState("");
  const [webText, setWebText] = useState("");
  const [saText, setSaText] = useState("");
  const [saFileName, setSaFileName] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const web = useMemo(() => {
    if (!webText.trim()) return { value: null, error: null };
    try {
      const value = parseWebConfigInput(webText);
      if (!value.apiKey || !value.projectId) return { value: null, error: "The config needs at least apiKey and projectId." };
      return { value, error: null };
    } catch (err) {
      return { value: null, error: err.message };
    }
  }, [webText]);

  const sa = useMemo(() => parseServiceAccount(saText), [saText]);

  async function readFile(file) {
    if (!file) return;
    if (file.size > 64 * 1024) {
      setError("That file is too large to be a service account key.");
      return;
    }
    setSaText(await file.text());
    setSaFileName(file.name);
  }

  const canSubmit = name.trim() && (type === "web" ? web.value : sa.value && acknowledged);

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        type === "web"
          ? { connectionType: "web", name: name.trim(), webConfig: web.value }
          : { connectionType: "admin", name: name.trim(), serviceAccount: sa.value, acknowledgeAdminAccess: true };
      const { connection } = await api("/api/connections", { method: "POST", body });
      // Drop the plaintext key from memory as soon as it has been sent.
      setSaText("");
      await loadConnections({ force: true });
      setActive(connection.id);
      toast(`Connection "${connection.name}" saved.`, "success");
      router.push(`/connections?test=${connection.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <TypeOption
          active={type === "web"}
          icon={Globe}
          title="Firebase Web Config"
          description="Runs in your browser with the Web SDK. Firestore Security Rules apply to every read and write."
          onClick={() => setType("web")}
        />
        <TypeOption
          active={type === "admin"}
          icon={KeyRound}
          title="Admin Service Account"
          description="Runs on the server with the Admin SDK. Full access that bypasses Security Rules."
          onClick={() => setType("admin")}
        />
      </div>

      <Card className="space-y-5 p-5">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label="Connection name" hint="A label for this project inside Studio.">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="my-app (staging)" maxLength={80} required />
        </Field>

        {type === "web" ? (
          <>
            <Field
              label="Firebase config"
              hint="Paste the config object from Firebase console → Project settings → Your apps. JSON or the JavaScript snippet both work."
              error={web.error}
            >
              <textarea
                className={cn(inputClass, "h-44 font-mono text-xs leading-5")}
                value={webText}
                onChange={(event) => setWebText(event.target.value)}
                placeholder={WEB_PLACEHOLDER}
                spellCheck={false}
              />
            </Field>
            {web.value ? (
              <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs sm:grid-cols-2">
                {["projectId", "authDomain", "appId", "storageBucket"].map((key) => (
                  <div key={key} className="min-w-0">
                    <span className="text-slate-500">{key}: </span>
                    <span className="break-all font-mono text-slate-200">{web.value[key] || "—"}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <Alert tone="info">
              Web config values are not secret, but your data is only as safe as your Security Rules. Studio can sign in to the
              project anonymously or with an email/password user when you browse data.
            </Alert>
          </>
        ) : (
          <>
            <Alert tone="warning" title="Admin SDK access bypasses Security Rules">
              Scripts and Explorer actions on this connection can read and modify everything in the project. The key is encrypted
              on the server (AES-256-GCM) and is never sent back to the browser or the code editor.
            </Alert>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-200">Service account key (JSON)</span>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => readFile(event.target.files?.[0])} />
                <Button icon={Upload} onClick={() => fileInput.current?.click()}>
                  Upload JSON key
                </Button>
                <span className="text-xs text-slate-500">{saFileName ? saFileName : "or paste it below"}</span>
              </div>
              <textarea
                className={cn(inputClass, "h-32 font-mono text-xs leading-5", sa.value && "text-transparent [text-shadow:0_0_6px_rgba(148,163,184,0.6)]")}
                value={saText}
                onChange={(event) => {
                  setSaText(event.target.value);
                  setSaFileName(null);
                }}
                placeholder='{ "type": "service_account", "project_id": "...", ... }'
                spellCheck={false}
                autoComplete="off"
              />
              {sa.error ? <div className="text-xs text-rose-300">{sa.error}</div> : null}
            </div>

            {sa.value ? (
              <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                <FileJson className="h-4 w-4 shrink-0 text-violet-300" />
                <div className="min-w-0 space-y-1">
                  <div>
                    <span className="text-slate-500">project_id: </span>
                    <span className="font-mono text-slate-200">{sa.value.project_id}</span>
                  </div>
                  <div className="break-all">
                    <span className="text-slate-500">client_email: </span>
                    <span className="font-mono text-slate-200">{sa.value.client_email}</span>
                  </div>
                  <div className="text-slate-500">private_key: detected (hidden)</div>
                </div>
              </div>
            ) : null}

            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-orange-500" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              I understand this connection has full administrative access to the project and should only be used by trusted operators.
            </label>
          </>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={() => router.push("/connections")}>Cancel</Button>
        <Button type="submit" variant="primary" loading={busy} disabled={!canSubmit}>
          Save connection
        </Button>
      </div>
    </form>
  );
}
