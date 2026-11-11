"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Database, Download, Filter, Plus, Search, Upload } from "lucide-react";
import { api } from "@/lib/api/client";
import { createDatabaseAdapter } from "@/lib/database/adapters";
import { createWebAuthController } from "@/lib/firebase/client";
import { pickColumns, previewValue } from "@/lib/firestore/preview";
import { toast, useActiveConnection, useStudioStore } from "@/lib/store/studio-store";
import { ConnectionPicker } from "@/components/layout/ConnectionPicker";
import { ProjectAuthPanel } from "@/components/connections/ProjectAuthPanel";
import { CollectionTree } from "@/components/database/CollectionTree";
import { DocumentEditor } from "@/components/database/DocumentEditor";
import { DocumentViewer } from "@/components/database/DocumentViewer";
import { EMPTY_QUERY, encodeFilters, QueryBuilder } from "@/components/database/QueryBuilder";
import { Alert, Badge, Button, cn, ConfirmDialog, controlClass, EmptyState, Modal, Spinner } from "@/components/ui";

function Breadcrumbs({ path, onNavigate }) {
  if (!path) return null;
  const parts = path.split("/");
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-xs">
      {parts.map((part, index) => {
        const isCollection = index % 2 === 0;
        const target = parts.slice(0, index + 1).join("/");
        const last = index === parts.length - 1;
        return (
          <span key={target} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3 w-3 text-slate-600" /> : null}
            {isCollection && !last ? (
              <button type="button" onClick={() => onNavigate(target)} className="text-sky-300 hover:underline">
                {part}
              </button>
            ) : (
              <span className={last ? "text-white" : "text-slate-400"}>{part}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function download(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseImportFile(text) {
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.documents) ? parsed.documents : null;
  if (list) {
    return list.map((item, index) => {
      if (!item || typeof item.id !== "string" || !item.data || typeof item.data !== "object") {
        throw new Error(`Entry #${index + 1} must look like { "id": "...", "data": { ... } }`);
      }
      return { id: item.id, data: item.data };
    });
  }
  if (parsed && typeof parsed === "object") {
    // { "<id>": { ...data } } map form.
    return Object.entries(parsed).map(([id, data]) => ({ id, data }));
  }
  throw new Error("Unsupported file format.");
}

export function DatabaseExplorer() {
  const connection = useActiveConnection();
  const connectionsStatus = useStudioStore((state) => state.connectionsStatus);
  const knownCollections = useStudioStore((state) => (connection ? state.knownCollections[connection.id] : null));
  const addKnownCollection = useStudioStore((state) => state.addKnownCollection);
  const removeKnownCollection = useStudioStore((state) => state.removeKnownCollection);

  const adapter = useMemo(() => {
    try {
      return createDatabaseAdapter(connection);
    } catch (error) {
      toast(error.message, "error");
      return null;
    }
  }, [connection]);
  const authController = useMemo(() => (connection?.connectionType === "web" ? createWebAuthController(connection) : null), [connection]);

  const [rootCollections, setRootCollections] = useState([]);
  const [collectionsState, setCollectionsState] = useState({ loading: false, error: null });
  const [collectionPath, setCollectionPath] = useState(null);
  const [query, setQuery] = useState(EMPTY_QUERY);
  const [showQuery, setShowQuery] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [listState, setListState] = useState({ loading: false, error: null });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // { document, subcollections }
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [editor, setEditor] = useState(null); // { mode, document? }
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeletes, setConfirmDeletes] = useState(true);
  const [importState, setImportState] = useState(null); // { documents, merge, busy, error }
  const importInput = useRef(null);
  const requestId = useRef(0);

  useEffect(() => {
    api("/api/settings")
      .then(({ settings }) => setConfirmDeletes(settings.confirmDeletes))
      .catch(() => {});
  }, []);

  // Reset when switching projects.
  useEffect(() => {
    setCollectionPath(null);
    setDocuments([]);
    setSelected(null);
    setQuery(EMPTY_QUERY);
    setListState({ loading: false, error: null });
  }, [connection?.id]);

  const loadCollections = useCallback(async () => {
    if (!adapter?.canListCollections) {
      setRootCollections([]);
      return;
    }
    setCollectionsState({ loading: true, error: null });
    try {
      const list = await adapter.listCollections();
      setRootCollections(list.map((item) => item.path));
      setCollectionsState({ loading: false, error: null });
    } catch (error) {
      setCollectionsState({ loading: false, error: error.message });
    }
  }, [adapter]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const runQuery = useCallback(
    async ({ append = false, path = collectionPath, nextQuery = query } = {}) => {
      if (!adapter || !path) return;
      const id = (requestId.current += 1);
      setListState({ loading: true, error: null });
      try {
        const filters = encodeFilters(nextQuery.filters);
        const result = await adapter.listDocuments({
          collection: path,
          filters,
          orderBy: nextQuery.orderBy.trim() || undefined,
          direction: nextQuery.direction,
          limit: nextQuery.limit,
          cursor: append ? nextCursor : undefined,
        });
        if (id !== requestId.current) return;
        setDocuments((current) => (append ? [...current, ...result.documents] : result.documents));
        setNextCursor(result.nextCursor);
        setListState({ loading: false, error: null });
      } catch (error) {
        if (id !== requestId.current) return;
        setListState({ loading: false, error: error.message });
        if (!append) setDocuments([]);
      }
    },
    [adapter, collectionPath, query, nextCursor],
  );

  function openCollection(path) {
    const clean = path.replace(/^\/+|\/+$/g, "");
    setCollectionPath(clean);
    setSelected(null);
    setSearch("");
    setQuery(EMPTY_QUERY);
    setNextCursor(null);
    if (connection?.connectionType === "web") addKnownCollection(connection.id, clean);
    runQuery({ path: clean, nextQuery: EMPTY_QUERY });
  }

  async function openDocument(doc) {
    setSelected({ document: doc, subcollections: null });
    setSelectedLoading(true);
    try {
      const fresh = await adapter.getDocument(doc.path);
      setSelected(fresh);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setSelectedLoading(false);
    }
  }

  async function submitEditor({ id, data }) {
    if (editor.mode === "create") {
      const created = await adapter.createDocument(collectionPath, id, data);
      toast(`Created ${created.path}`, "success");
      setEditor(null);
      setDocuments((current) => [created, ...current]);
      openDocument(created);
    } else {
      const updated = await adapter.setDocument(editor.document.path, data);
      toast(`Saved ${updated.path}`, "success");
      setEditor(null);
      setDocuments((current) => current.map((item) => (item.path === updated.path ? updated : item)));
      setSelected((current) => ({ ...current, document: updated }));
    }
  }

  async function deleteDocument(doc) {
    setDeleting(true);
    try {
      await adapter.deleteDocument(doc.path);
      toast(`Deleted ${doc.path}`, "success");
      setDocuments((current) => current.filter((item) => item.path !== doc.path));
      if (selected?.document.path === doc.path) setSelected(null);
      setPendingDelete(null);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setDeleting(false);
    }
  }

  function requestDelete(doc) {
    if (confirmDeletes) setPendingDelete(doc);
    else deleteDocument(doc);
  }

  function exportDocuments() {
    download(`${collectionPath.replace(/\//g, "_")}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`, {
      collection: collectionPath,
      projectId: connection.projectId,
      exportedAt: new Date().toISOString(),
      format: "firebase-studio/v1",
      documents: documents.map((doc) => ({ id: doc.id, data: doc.data })),
    });
  }

  async function chooseImportFile(file) {
    if (!file) return;
    try {
      const docs = parseImportFile(await file.text());
      if (docs.length === 0) throw new Error("The file contains no documents.");
      if (docs.length > 5000) throw new Error("Import is limited to 5,000 documents per file.");
      setImportState({ documents: docs, merge: false, busy: false, error: null, fileName: file.name });
    } catch (error) {
      toast(`Import: ${error.message}`, "error");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }

  async function runImport() {
    setImportState((state) => ({ ...state, busy: true, error: null }));
    try {
      const count = await adapter.importDocuments(collectionPath, importState.documents, { merge: importState.merge });
      toast(`Imported ${count} documents into ${collectionPath}.`, "success");
      setImportState(null);
      runQuery();
    } catch (error) {
      setImportState((state) => ({ ...state, busy: false, error: error.message }));
    }
  }

  const columns = useMemo(() => pickColumns(documents), [documents]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) => doc.id.toLowerCase().includes(term) || JSON.stringify(doc.data).toLowerCase().includes(term));
  }, [documents, search]);

  if (connectionsStatus === "ready" && !connection) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Database}
          title="No Firebase project connected"
          description="Add a connection to browse collections and edit documents."
          action={
            <Link href="/connections/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-orange-500 px-3.5 text-sm font-medium text-white hover:bg-orange-400">
              <Plus className="h-4 w-4" /> Add Firebase project
            </Link>
          }
        />
      </div>
    );
  }

  const treeCollections = adapter?.canListCollections ? rootCollections : knownCollections || [];

  return (
    <div className="flex h-full min-h-[560px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <ConnectionPicker className="w-full sm:w-72" />
        {connection ? (
          <span className="text-xs text-slate-500">
            {connection.connectionType === "admin" ? "Admin SDK via Studio server — Security Rules bypassed" : "Web SDK in this browser — Security Rules enforced"}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 md:flex">
          <div className="min-h-0 flex-1">
            <CollectionTree
              canList={Boolean(adapter?.canListCollections)}
              collections={treeCollections}
              loading={collectionsState.loading}
              error={collectionsState.error}
              activePath={collectionPath}
              onOpen={openCollection}
              onRefresh={loadCollections}
              onForget={connection?.connectionType === "web" ? (path) => removeKnownCollection(connection.id, path) : undefined}
            />
          </div>
          {authController ? (
            <div className="border-t border-slate-800 p-2">
              <ProjectAuthPanel controller={authController} scopeLabel="explorer" />
            </div>
          ) : null}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          {!collectionPath ? (
            <div className="p-6">
              {/* Mobile has no sidebar: offer the path input here too. */}
              <div className="mb-4 md:hidden">
                <CollectionTree
                  canList={Boolean(adapter?.canListCollections)}
                  collections={treeCollections}
                  loading={collectionsState.loading}
                  error={collectionsState.error}
                  activePath={collectionPath}
                  onOpen={openCollection}
                  onRefresh={loadCollections}
                />
              </div>
              <EmptyState icon={Database} title="Select a collection" description="Pick a collection on the left, or type a collection path (including subcollections like users/uid/orders)." />
            </div>
          ) : (
            <>
              <div className="space-y-2 border-b border-slate-800 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Breadcrumbs path={collectionPath} onNavigate={openCollection} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" />
                      <input
                        className={cn(controlClass, "h-8 w-40 py-1 pl-7 text-xs")}
                        placeholder="Search loaded docs"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <Button size="sm" icon={Filter} onClick={() => setShowQuery((value) => !value)} className={showQuery || query.filters.length ? "border-orange-400/50" : ""}>
                      Query{query.filters.length ? ` (${query.filters.length})` : ""}
                    </Button>
                    <Button size="sm" icon={Download} onClick={exportDocuments} disabled={!documents.length} title="Export loaded documents as JSON">
                      Export
                    </Button>
                    <input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => chooseImportFile(event.target.files?.[0])} />
                    <Button size="sm" icon={Upload} onClick={() => importInput.current?.click()} title="Import documents from JSON">
                      Import
                    </Button>
                    <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditor({ mode: "create" })}>
                      Add
                    </Button>
                  </div>
                </div>
                {showQuery ? <QueryBuilder query={query} onChange={setQuery} onRun={() => runQuery()} running={listState.loading} /> : null}
              </div>

              <div className="flex min-h-0 flex-1">
                <div className="min-w-0 flex-1 overflow-auto">
                  {listState.error ? (
                    <div className="p-3">
                      <Alert tone="error" title="Query failed">
                        {listState.error}
                      </Alert>
                    </div>
                  ) : null}
                  {listState.loading && documents.length === 0 ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
                      <Spinner /> Loading documents…
                    </div>
                  ) : null}
                  {!listState.loading && !listState.error && documents.length === 0 ? (
                    <EmptyState className="m-4" icon={Database} title="No documents" description="This query returned no documents. Add one to create the collection." />
                  ) : null}

                  {filtered.length ? (
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-900 text-xs text-slate-400">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Document ID</th>
                          {columns.map((column) => (
                            <th key={column} className="whitespace-nowrap px-3 py-2 text-left font-mono font-medium">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filtered.map((doc) => (
                          <tr
                            key={doc.path}
                            onClick={() => openDocument(doc)}
                            className={cn("cursor-pointer hover:bg-slate-900", selected?.document.path === doc.path && "bg-slate-800/70")}
                          >
                            <td className="max-w-[16rem] truncate whitespace-nowrap px-3 py-1.5 font-mono text-xs text-sky-300">{doc.id}</td>
                            {columns.map((column) => (
                              <td key={column} className="max-w-[14rem] truncate whitespace-nowrap px-3 py-1.5 font-mono text-xs text-slate-300">
                                {doc.data && column in doc.data ? previewValue(doc.data[column]) : <span className="text-slate-700">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}

                  {documents.length ? (
                    <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
                      <span>
                        {filtered.length === documents.length ? `${documents.length} loaded` : `${filtered.length} of ${documents.length} loaded match`}
                      </span>
                      {nextCursor ? (
                        <Button size="xs" onClick={() => runQuery({ append: true })} loading={listState.loading}>
                          Load more
                        </Button>
                      ) : (
                        <Badge>end of results</Badge>
                      )}
                    </div>
                  ) : null}
                </div>

                {selected ? (
                  <aside className="hidden w-[26rem] shrink-0 border-l border-slate-800 lg:block">
                    <DocumentViewer
                      document={selected.document}
                      subcollections={selected.subcollections}
                      loading={selectedLoading}
                      onClose={() => setSelected(null)}
                      onEdit={() => setEditor({ mode: "edit", document: selected.document })}
                      onDelete={() => requestDelete(selected.document)}
                      onOpenCollection={openCollection}
                    />
                  </aside>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Small screens: show the selected document in a modal. */}
      <div className="lg:hidden">
        <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.document.id || ""} size="lg">
          {selected ? (
            <div className="h-[60vh]">
              <DocumentViewer
                document={selected.document}
                subcollections={selected.subcollections}
                loading={selectedLoading}
                onClose={() => setSelected(null)}
                onEdit={() => setEditor({ mode: "edit", document: selected.document })}
                onDelete={() => requestDelete(selected.document)}
                onOpenCollection={(path) => {
                  setSelected(null);
                  openCollection(path);
                }}
              />
            </div>
          ) : null}
        </Modal>
      </div>

      <DocumentEditor
        open={Boolean(editor)}
        mode={editor?.mode}
        document={editor?.document}
        collectionPath={collectionPath}
        onClose={() => setEditor(null)}
        onSubmit={submitEditor}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete document?"
        message={
          <>
            <span className="font-mono text-slate-100">{pendingDelete?.path}</span> will be permanently deleted. Subcollections of this document are not
            deleted automatically.
          </>
        }
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={() => deleteDocument(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

      <Modal
        open={Boolean(importState)}
        onClose={importState?.busy ? undefined : () => setImportState(null)}
        title={`Import into ${collectionPath}`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setImportState(null)} disabled={importState?.busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={runImport} loading={importState?.busy}>
              Import {importState?.documents.length} documents
            </Button>
          </>
        }
      >
        {importState ? (
          <div className="space-y-3 text-sm text-slate-300">
            {importState.error ? <Alert tone="error">{importState.error}</Alert> : null}
            <p>
              <span className="font-mono">{importState.fileName}</span> contains <strong>{importState.documents.length}</strong> documents. Existing documents with the same
              ID will be {importState.merge ? "merged with" : "overwritten by"} the imported data.
            </p>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-orange-500" checked={importState.merge} onChange={(event) => setImportState((state) => ({ ...state, merge: event.target.checked }))} />
              Merge into existing documents instead of replacing them
            </label>
            <p className="text-xs text-slate-500">Expected format: the Studio export file, an array of {"{ id, data }"}, or an object keyed by document ID.</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
