"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileCode2, FolderTree, Info, LayoutTemplate, Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api/client";
import { BrowserSandbox } from "@/lib/execution/client-runner";
import { executionModeFor } from "@/lib/execution/modes";
import { defaultCode, TEMPLATES } from "@/lib/execution/templates";
import { createSandboxAuthController } from "@/lib/firebase/client";
import { toast, useActiveConnection, useStudioStore } from "@/lib/store/studio-store";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { OutputConsole } from "@/components/editor/OutputConsole";
import { ProjectAuthPanel } from "@/components/connections/ProjectAuthPanel";
import { Alert, Button, ConfirmDialog, EmptyState, Field, inputClass, Modal, Spinner } from "@/components/ui";

const MAX_ENTRIES = 2000;

function SidebarSection({ icon: Icon, title, action, children }) {
  return (
    <div className="border-b border-slate-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          <Icon className="h-3.5 w-3.5" /> {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SidebarItem({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`block w-full truncate rounded-md px-2 py-1 text-left text-sm ${active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"}`}
    >
      {children}
    </button>
  );
}

export function Playground() {
  const router = useRouter();
  const params = useSearchParams();
  const connection = useActiveConnection();
  const connectionsStatus = useStudioStore((state) => state.connectionsStatus);
  const setActive = useStudioStore((state) => state.setActiveConnectionId);
  const knownCollections = useStudioStore((state) => (connection ? state.knownCollections[connection.id] : null));
  const mode = connection ? executionModeFor(connection) : null;

  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState(null);
  const [script, setScript] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);

  const [entries, setEntries] = useState([]);
  const [run, setRun] = useState(null);
  const [running, setRunning] = useState(false);

  const [sandbox, setSandbox] = useState(null);
  const [sandboxStatus, setSandboxStatus] = useState({ status: "idle" });
  const sandboxUser = useRef(null);
  const authListeners = useRef(new Set());
  const sandboxHost = useRef(null);
  const editorRef = useRef(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingReplace, setPendingReplace] = useState(null);

  const dirty = savedCode === null ? code.trim() !== "" && code !== defaultCode(mode) : code !== savedCode;

  // ------------------------------------------------------------ data loading

  const loadScripts = useCallback(async () => {
    try {
      const { scripts: list } = await api("/api/scripts");
      setScripts(list);
    } catch (error) {
      toast(error.message, "error");
    }
  }, []);

  useEffect(() => {
    loadScripts();
    api("/api/settings")
      .then(({ settings }) => setTimeoutSeconds(settings.defaultTimeoutSeconds))
      .catch(() => {});
  }, [loadScripts]);

  // Open ?script=<id>.
  const scriptParam = params.get("script");
  useEffect(() => {
    if (!scriptParam) return;
    api(`/api/scripts/${scriptParam}`)
      .then(({ script: loaded }) => {
        setScript(loaded);
        setCode(loaded.code);
        setSavedCode(loaded.code);
        setEntries([]);
        setRun(null);
        if (loaded.connectionId) setActive(loaded.connectionId);
      })
      .catch((error) => toast(error.message, "error"));
  }, [scriptParam, setActive]);

  // New, unsaved session: start from the template for the current mode.
  useEffect(() => {
    if (!mode || scriptParam) return;
    setCode((current) => (current.trim() === "" || Object.values(TEMPLATES).some((list) => list[0].code === current) ? defaultCode(mode) : current));
  }, [mode, scriptParam]);

  const refreshCollections = useCallback(async () => {
    if (!connection || connection.connectionType !== "admin") {
      setCollections([]);
      return;
    }
    setCollectionsLoading(true);
    try {
      const { collections: list } = await api("/api/database/collections", { query: { connectionId: connection.id } });
      setCollections(list.map((item) => item.path));
    } catch (error) {
      setCollections([]);
      toast(`Collections: ${error.message}`, "error");
    } finally {
      setCollectionsLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    refreshCollections();
  }, [refreshCollections]);

  // ------------------------------------------------------- browser sandbox

  useEffect(() => {
    if (!connection || connection.connectionType !== "web" || !sandboxHost.current) return undefined;
    const instance = new BrowserSandbox({
      onStatus: (status, detail) => setSandboxStatus({ status, detail }),
      onAuthState: (user) => {
        sandboxUser.current = user;
        authListeners.current.forEach((listener) => listener(user));
      },
      onReset: (reason) => {
        if (reason === "timeout") toast("The sandbox was restarted after a timeout. Project sign-in was reset.", "info");
      },
    });
    instance.mount(sandboxHost.current);
    instance.init(connection.webConfig).catch(() => {});
    setSandbox(instance);
    return () => {
      instance.destroy();
      sandboxUser.current = null;
      authListeners.current.forEach((listener) => listener(null));
      setSandbox(null);
    };
    // Recreate only when the connection itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id, connection?.updatedAt]);

  const sandboxAuth = useMemo(() => {
    if (!sandbox) return null;
    return createSandboxAuthController(sandbox, (listener) => {
      authListeners.current.add(listener);
      listener(sandboxUser.current);
      return () => authListeners.current.delete(listener);
    });
  }, [sandbox]);

  // --------------------------------------------------------------- running

  const appendEntry = useCallback((entry) => {
    setEntries((current) => (current.length >= MAX_ENTRIES ? current : [...current, entry]));
  }, []);

  const execute = useCallback(async () => {
    if (!connection || running || !code.trim()) return;
    setRunning(true);
    setEntries([]);
    setRun(null);
    const timeoutMs = timeoutSeconds * 1000;
    const scriptId = script?.id ?? null;

    try {
      if (mode === "browser") {
        if (!sandbox) throw new Error("The browser sandbox is not ready yet.");
        const collected = [];
        const outcome = await sandbox.run(code, {
          timeoutMs,
          onLog: (entry) => {
            if (collected.length < MAX_ENTRIES) collected.push(entry);
            appendEntry(entry);
          },
        });
        setRun(outcome);
        api("/api/execution/client", {
          method: "POST",
          body: {
            connectionId: connection.id,
            scriptId,
            code,
            status: outcome.status,
            durationMs: Math.round(outcome.durationMs || 0),
            logs: collected,
            result: outcome.result,
            error: outcome.error,
          },
        }).catch(() => {});
      } else {
        const outcome = await api("/api/execution/server", {
          method: "POST",
          body: { connectionId: connection.id, code, scriptId, timeoutMs },
        });
        setEntries(outcome.logs || []);
        setRun(outcome);
      }
    } catch (error) {
      setRun({ status: "error", error: { name: "Error", message: error.message }, durationMs: 0 });
    } finally {
      setRunning(false);
    }
  }, [appendEntry, code, connection, mode, running, sandbox, script, timeoutSeconds]);

  // ---------------------------------------------------------------- saving

  async function saveExisting() {
    setSaving(true);
    try {
      const { script: updated } = await api(`/api/scripts/${script.id}`, {
        method: "PUT",
        body: { code, connectionId: connection?.id ?? script.connectionId ?? null },
      });
      setScript(updated);
      setSavedCode(updated.code);
      toast(`Saved "${updated.name}".`, "success");
      loadScripts();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveNew(event) {
    event?.preventDefault();
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const { script: created } = await api("/api/scripts", {
        method: "POST",
        body: { name: saveName.trim(), code, connectionId: connection?.id ?? null },
      });
      setScript(created);
      setSavedCode(created.code);
      setSaveOpen(false);
      toast(`Saved "${created.name}".`, "success");
      router.replace(`/playground?script=${created.id}`);
      loadScripts();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (script) saveExisting();
    else {
      setSaveName("");
      setSaveOpen(true);
    }
  }

  // ------------------------------------------------------- replacing code

  function replaceCode(action) {
    if (dirty) setPendingReplace(action);
    else action();
  }

  function startNew() {
    replaceCode(() => {
      setScript(null);
      setSavedCode(null);
      setCode(defaultCode(mode));
      setEntries([]);
      setRun(null);
      router.replace("/playground");
    });
  }

  function openScript(item) {
    replaceCode(() => router.push(`/playground?script=${item.id}`));
  }

  function applyTemplate(template) {
    replaceCode(() => {
      setScript(null);
      setSavedCode(null);
      setCode(template.code);
      router.replace("/playground");
    });
  }

  function insertSnippet(text) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.executeEdits("studio", [{ range: editor.getSelection(), text, forceMoveMarkers: true }]);
    editor.focus();
  }

  function jumpToLine(line) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
  }

  // ---------------------------------------------------------------- render

  if (connectionsStatus === "ready" && !connection) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileCode2}
          title="Connect a Firebase project to start coding"
          description="The playground runs your JavaScript against a connected project: in the browser for Web config connections, or in an isolated Node.js worker for Admin connections."
          action={
            <Link href="/connections/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-500 px-3.5 text-sm font-medium text-white hover:bg-orange-400">
              <Plus className="h-4 w-4" /> Add Firebase project
            </Link>
          }
        />
      </div>
    );
  }

  const sidebarCollections = connection?.connectionType === "admin" ? collections : knownCollections || [];
  const browserNotReady = mode === "browser" && sandboxStatus.status !== "ready";

  return (
    <div className="flex h-full min-h-[600px] flex-col">
      <EditorToolbar
        mode={mode}
        scriptName={script?.name}
        dirty={dirty}
        timeoutSeconds={timeoutSeconds}
        onTimeoutChange={setTimeoutSeconds}
        running={running}
        canRun={Boolean(connection) && !browserNotReady}
        canStop={mode === "browser"}
        onRun={execute}
        onStop={() => sandbox?.cancel()}
        onSave={save}
        onNew={startNew}
        saving={saving}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 md:block">
          {mode ? (
            <div className="flex items-start gap-2 border-b border-slate-800 p-3 text-xs leading-5 text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              {mode === "browser" ? (
                <span>
                  Runs in a sandboxed iframe with the Web SDK. Globals: <code className="text-slate-300">db</code>, <code className="text-slate-300">auth</code>,{" "}
                  <code className="text-slate-300">firebase</code>. Security Rules apply.
                </span>
              ) : (
                <span>
                  Runs in an isolated Node.js worker with the Admin SDK. Globals: <code className="text-slate-300">db</code>, <code className="text-slate-300">admin</code>,{" "}
                  <code className="text-slate-300">process.env</code>, <code className="text-slate-300">Buffer</code>. Bypasses Security Rules.
                </span>
              )}
            </div>
          ) : null}

          {mode === "browser" ? (
            <div className="border-b border-slate-800 p-3">
              {sandboxStatus.status === "error" ? (
                <Alert tone="error" title="Sandbox failed to start">
                  {sandboxStatus.detail}
                </Alert>
              ) : sandboxStatus.status !== "ready" ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Spinner className="h-3.5 w-3.5" /> Starting browser sandbox…
                </div>
              ) : (
                <ProjectAuthPanel controller={sandboxAuth} scopeLabel="this tab" />
              )}
            </div>
          ) : null}

          <SidebarSection
            icon={FolderTree}
            title="Collections"
            action={
              connection?.connectionType === "admin" ? (
                <button type="button" onClick={refreshCollections} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200" aria-label="Refresh collections">
                  <RefreshCw className={`h-3.5 w-3.5 ${collectionsLoading ? "animate-spin" : ""}`} />
                </button>
              ) : null
            }
          >
            {sidebarCollections.length ? (
              <div className="space-y-0.5">
                {sidebarCollections.map((path) => (
                  <SidebarItem key={path} onClick={() => insertSnippet(`db.collection(${JSON.stringify(path)})`)} title="Insert at cursor">
                    <span className="font-mono text-xs">{path}</span>
                  </SidebarItem>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {connection?.connectionType === "web"
                  ? "The Web SDK cannot list collections. Collections you open in the Database explorer appear here."
                  : collectionsLoading
                    ? "Loading…"
                    : "No collections found."}
              </p>
            )}
          </SidebarSection>

          <SidebarSection icon={FileCode2} title="Saved scripts">
            {scripts.length ? (
              <div className="space-y-0.5">
                {scripts.map((item) => (
                  <SidebarItem key={item.id} active={script?.id === item.id} onClick={() => openScript(item)} title={item.description || item.name}>
                    {item.name}
                  </SidebarItem>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Save a script with Ctrl/⌘ + S.</p>
            )}
          </SidebarSection>

          {mode ? (
            <SidebarSection icon={LayoutTemplate} title="Templates">
              <div className="space-y-0.5">
                {TEMPLATES[mode].map((template) => (
                  <SidebarItem key={template.id} onClick={() => applyTemplate(template)}>
                    {template.name}
                  </SidebarItem>
                ))}
              </div>
            </SidebarSection>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-[220px] flex-[3] border-b border-slate-800">
            <CodeEditor
              value={code}
              onChange={setCode}
              mode={mode}
              onRun={execute}
              onSave={save}
              onReady={(editor) => {
                editorRef.current = editor;
              }}
              errorLine={run?.error?.line}
              path="playground.js"
            />
          </div>
          <OutputConsole
            className="min-h-[160px] flex-[2]"
            entries={entries}
            run={run}
            running={running}
            onClear={() => {
              setEntries([]);
              setRun(null);
            }}
            onJumpToLine={jumpToLine}
          />
        </div>
      </div>

      <div ref={sandboxHost} />

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save script"
        size="sm"
        footer={
          <>
            <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveNew} loading={saving} disabled={!saveName.trim()}>
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={saveNew}>
          <Field label="Name" hint={connection ? `Linked to ${connection.name} (${mode} mode).` : undefined}>
            <input className={inputClass} value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="students/status-sync" autoFocus maxLength={120} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingReplace)}
        title="Discard unsaved changes?"
        message="The current editor contents have not been saved."
        confirmLabel="Discard"
        onConfirm={() => {
          const action = pendingReplace;
          setPendingReplace(null);
          action?.();
        }}
        onCancel={() => setPendingReplace(null)}
      />
    </div>
  );
}
