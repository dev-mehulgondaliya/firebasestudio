"use client";

import { useEffect, useState } from "react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { Alert, Button, Field, inputClass, Modal } from "@/components/ui";

const TYPE_HELP = [
  ['{"$timestamp": "2024-05-01T10:00:00Z"}', "Timestamp"],
  ['{"$geopoint": {"latitude": 51.5, "longitude": -0.1}}', "GeoPoint"],
  ['{"$ref": "users/alice"}', "Reference"],
  ['{"$bytes": "aGVsbG8="}', "Bytes"],
];

/**
 * Create or replace a document using the type-preserving JSON format.
 * `mode` is "create" (optional ID, fails if the ID exists) or "edit" (replaces the document).
 */
export function DocumentEditor({ open, mode, collectionPath, document, onClose, onSubmit }) {
  const [text, setText] = useState("{}");
  const [id, setId] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setId("");
    setText(mode === "edit" && document ? JSON.stringify(document.data ?? {}, null, 2) : '{\n  "name": "",\n  "createdAt": {"$timestamp": "' + new Date().toISOString() + '"}\n}');
  }, [open, mode, document]);

  async function submit() {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
      return;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      setError("A document must be a JSON object.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ id: id.trim() || undefined, data });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      size="lg"
      title={mode === "edit" ? `Edit ${document?.id}` : `Add document to ${collectionPath}`}
      description={mode === "edit" ? "Saving replaces the whole document. Special types use $-tagged values and are preserved." : "Leave the ID empty to let Firestore generate one."}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {mode === "edit" ? "Save document" : "Create document"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {mode === "create" ? (
          <Field label="Document ID" hint="Optional. Creating fails if this ID already exists.">
            <input className={`${inputClass} font-mono`} value={id} onChange={(event) => setId(event.target.value)} placeholder="auto-generated" />
          </Field>
        ) : null}
        <div className="h-[45vh] min-h-[260px] overflow-hidden rounded-lg border border-slate-800">
          {open ? <CodeEditor language="json" value={text} onChange={setText} onSave={submit} path={`document-${mode}.json`} /> : null}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          {TYPE_HELP.map(([example, label]) => (
            <span key={label}>
              {label}: <code className="text-slate-400">{example}</code>
            </span>
          ))}
        </div>
      </div>
    </Modal>
  );
}
