"use client";

import { useState } from "react";
import { FolderOpen, FolderPlus, RefreshCw, X } from "lucide-react";
import { Button, cn, inputClass, Spinner } from "@/components/ui";

/**
 * Left panel of the explorer. Admin connections list root collections from
 * the server; Web SDK connections can't list collections, so the user opens
 * them by path and Studio remembers them.
 */
export function CollectionTree({ canList, collections, loading, error, activePath, onOpen, onRefresh, onForget }) {
  const [path, setPath] = useState("");

  function submit(event) {
    event.preventDefault();
    const value = path.trim().replace(/^\/+|\/+$/g, "");
    if (!value) return;
    if (value.split("/").length % 2 === 0) return;
    onOpen(value);
    setPath("");
  }

  const invalid = path.trim() && path.trim().replace(/^\/+|\/+$/g, "").split("/").length % 2 === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Collections</div>
        {canList ? (
          <button type="button" onClick={onRefresh} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200" aria-label="Refresh collections">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        ) : null}
      </div>

      <form onSubmit={submit} className="border-b border-slate-800 p-2">
        <div className="flex gap-1.5">
          <input
            className={cn(inputClass, "h-8 py-1 font-mono text-xs")}
            placeholder="collection or a/b/c path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            aria-label="Collection path"
          />
          <Button type="submit" size="sm" icon={FolderPlus} aria-label="Open collection" disabled={!path.trim() || invalid} />
        </div>
        {invalid ? <div className="mt-1 text-[11px] text-amber-300">Collection paths have an odd number of segments.</div> : null}
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && collections.length === 0 ? (
          <div className="flex items-center gap-2 p-2 text-xs text-slate-500">
            <Spinner className="h-3.5 w-3.5" /> Loading…
          </div>
        ) : null}
        {error ? <div className="break-words p-2 text-xs text-rose-300">{error}</div> : null}
        {!loading && !error && collections.length === 0 ? (
          <p className="p-2 text-xs leading-5 text-slate-500">
            {canList ? "This project has no collections yet. Open a path above to create one by adding a document." : "The Web SDK cannot list collections. Type a collection name above to open it."}
          </p>
        ) : null}
        <div className="space-y-0.5">
          {collections.map((item) => (
            <div key={item} className="group flex items-center">
              <button
                type="button"
                onClick={() => onOpen(item)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  activePath === item ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60",
                )}
              >
                <FolderOpen className={cn("h-3.5 w-3.5 shrink-0", activePath === item ? "text-orange-400" : "text-slate-500")} />
                <span className="truncate font-mono text-xs">{item}</span>
              </button>
              {onForget ? (
                <button
                  type="button"
                  onClick={() => onForget(item)}
                  className="invisible rounded p-1 text-slate-600 hover:text-slate-300 group-hover:visible"
                  aria-label={`Forget ${item}`}
                  title="Remove from this list"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
