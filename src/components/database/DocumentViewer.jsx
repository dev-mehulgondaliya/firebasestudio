"use client";

import { Copy, FolderOpen, Pencil, Trash2, X } from "lucide-react";
import { toast } from "@/lib/store/studio-store";
import { typeOf } from "@/lib/firestore/preview";
import { JsonView } from "@/components/database/JsonView";
import { Badge, Button, Spinner } from "@/components/ui";

export function DocumentViewer({ document, subcollections, loading, onEdit, onDelete, onClose, onOpenCollection }) {
  if (!document) return null;

  async function copy() {
    await navigator.clipboard?.writeText(JSON.stringify(document.data, null, 2));
    toast("Document JSON copied.", "success");
  }

  const fields = Object.entries(document.data || {});

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm text-white">{document.id}</div>
          <div className="truncate font-mono text-[11px] text-slate-500">{document.path}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200" aria-label="Close document">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-3 py-2">
        <Button size="xs" icon={Pencil} onClick={onEdit} disabled={!document.exists}>
          Edit
        </Button>
        <Button size="xs" icon={Copy} onClick={copy} disabled={!document.exists}>
          Copy JSON
        </Button>
        <Button size="xs" variant="dangerGhost" icon={Trash2} onClick={onDelete} disabled={!document.exists}>
          Delete
        </Button>
        {loading ? <Spinner className="ml-auto h-3.5 w-3.5" /> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!document.exists ? (
          <div className="p-3 text-sm text-slate-400">This document does not exist (it may have been deleted).</div>
        ) : (
          <>
            <div className="border-b border-slate-800 px-3 py-2">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">Fields ({fields.length})</div>
              <div className="flex flex-wrap gap-1">
                {fields.slice(0, 40).map(([key, value]) => (
                  <Badge key={key}>
                    <span className="font-mono">{key}</span>
                    <span className="text-slate-500">{typeOf(value)}</span>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="p-3">
              <JsonView value={document.data} />
            </div>
          </>
        )}

        {subcollections?.length ? (
          <div className="border-t border-slate-800 px-3 py-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">Subcollections</div>
            {subcollections.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => onOpenCollection(item.path)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-slate-300 hover:bg-slate-800"
              >
                <FolderOpen className="h-3.5 w-3.5 text-slate-500" />
                <span className="font-mono text-xs">{item.id}</span>
              </button>
            ))}
          </div>
        ) : null}

        {document.updateTime || document.createTime ? (
          <div className="space-y-0.5 border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
            {document.createTime ? <div>Created {new Date(document.createTime).toLocaleString()}</div> : null}
            {document.updateTime ? <div>Updated {new Date(document.updateTime).toLocaleString()}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
