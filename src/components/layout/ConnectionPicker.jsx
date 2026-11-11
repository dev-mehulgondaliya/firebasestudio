"use client";

import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { useStudioStore } from "@/lib/store/studio-store";
import { Badge, cn, Spinner } from "@/components/ui";

export function ConnectionTypeBadge({ type }) {
  return type === "admin" ? <Badge tone="violet">Admin SDK</Badge> : <Badge tone="blue">Web SDK</Badge>;
}

/** Selects the active Firebase connection (shared by Explorer and Playground). */
export function ConnectionPicker({ className }) {
  const connections = useStudioStore((state) => state.connections);
  const status = useStudioStore((state) => state.connectionsStatus);
  const activeId = useStudioStore((state) => state.activeConnectionId);
  const setActive = useStudioStore((state) => state.setActiveConnectionId);

  if (status !== "ready" && connections.length === 0) {
    return (
      <div className={cn("flex h-9 items-center gap-2 rounded-lg border border-slate-800 px-3 text-sm text-slate-400", className)}>
        <Spinner /> Loading connections…
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <Link
        href="/connections/new"
        className={cn("inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-slate-700 px-3 text-sm text-slate-300 hover:border-orange-400/60 hover:text-white", className)}
      >
        <Plus className="h-4 w-4" /> Add a Firebase connection
      </Link>
    );
  }

  const active = connections.find((connection) => connection.id === activeId);

  return (
    <div className={cn("relative flex items-center", className)}>
      <select
        aria-label="Active connection"
        value={activeId || ""}
        onChange={(event) => setActive(event.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 pl-3 pr-28 text-sm text-slate-100 outline-none hover:border-slate-600 focus:border-orange-400/70"
      >
        {connections.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.name} — {connection.projectId}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 flex items-center gap-1.5">
        {active ? <ConnectionTypeBadge type={active.connectionType} /> : null}
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </div>
    </div>
  );
}
