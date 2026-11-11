"use client";

import { FilePlus2, Globe, Play, Save, Server, Square } from "lucide-react";
import { ConnectionPicker } from "@/components/layout/ConnectionPicker";
import { Badge, Button, cn } from "@/components/ui";

const TIMEOUTS = [10, 30, 60, 120];

export function ModeBadge({ mode }) {
  if (!mode) return null;
  return mode === "server" ? (
    <Badge tone="violet">
      <Server className="h-3 w-3" /> Server · Admin SDK
    </Badge>
  ) : (
    <Badge tone="blue">
      <Globe className="h-3 w-3" /> Browser · Web SDK
    </Badge>
  );
}

export function EditorToolbar({
  mode,
  scriptName,
  dirty,
  timeoutSeconds,
  onTimeoutChange,
  running,
  canRun,
  canStop,
  onRun,
  onStop,
  onSave,
  onNew,
  saving,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2">
      <ConnectionPicker className="w-full sm:w-72" />
      <ModeBadge mode={mode} />
      <div className="flex min-w-0 items-center gap-1.5 px-1 text-sm">
        <span className={cn("truncate", scriptName ? "text-slate-200" : "italic text-slate-500")}>{scriptName || "Untitled script"}</span>
        {dirty ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Unsaved changes" /> : null}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          Timeout
          <select
            value={timeoutSeconds}
            onChange={(event) => onTimeoutChange(Number(event.target.value))}
            className="h-8 rounded-md border border-slate-700 bg-slate-900 px-1.5 text-xs text-slate-200 outline-none"
          >
            {[...new Set([...TIMEOUTS, timeoutSeconds])].sort((a, b) => a - b).map((value) => (
              <option key={value} value={value}>
                {value}s
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" icon={FilePlus2} onClick={onNew} title="New script">
          New
        </Button>
        <Button size="sm" icon={Save} onClick={onSave} loading={saving} title="Save (Ctrl/⌘+S)">
          Save
        </Button>
        {running && canStop ? (
          <Button size="sm" variant="danger" icon={Square} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={Play} onClick={onRun} loading={running} disabled={!canRun} title="Run (Ctrl/⌘+Enter)">
            Run
          </Button>
        )}
      </div>
    </div>
  );
}
