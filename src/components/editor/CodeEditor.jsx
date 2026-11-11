"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
      <Spinner /> Loading editor…
    </div>
  ),
});

// Loose typings so the editor offers completions for the predefined globals.
const SHARED_TYPES = `
interface StudioDocumentSnapshot { id: string; exists: boolean; ref: StudioDocumentReference; data(): any; get(field: string): any; }
interface StudioQuerySnapshot { docs: StudioDocumentSnapshot[]; size: number; empty: boolean; forEach(callback: (doc: StudioDocumentSnapshot) => void): void; }
interface StudioQuery {
  where(field: string, op: "<" | "<=" | "==" | "!=" | ">=" | ">" | "array-contains" | "in" | "not-in" | "array-contains-any", value: any): StudioQuery;
  orderBy(field: string, direction?: "asc" | "desc"): StudioQuery;
  limit(count: number): StudioQuery;
  startAfter(...values: any[]): StudioQuery;
  get(): Promise<StudioQuerySnapshot>;
  count(): { get(): Promise<{ data(): { count: number } }> };
}
interface StudioCollectionReference extends StudioQuery { id: string; path: string; doc(id?: string): StudioDocumentReference; add(data: object): Promise<StudioDocumentReference>; }
interface StudioDocumentReference {
  id: string; path: string; parent: StudioCollectionReference;
  get(): Promise<StudioDocumentSnapshot>;
  set(data: object, options?: { merge?: boolean }): Promise<any>;
  update(data: object): Promise<any>;
  delete(): Promise<any>;
  collection(path: string): StudioCollectionReference;
}
interface StudioFirestore {
  collection(path: string): StudioCollectionReference;
  doc(path: string): StudioDocumentReference;
  collectionGroup(collectionId: string): StudioQuery;
  batch(): any;
  runTransaction<T>(update: (transaction: any) => Promise<T>): Promise<T>;
}
`;

export const EDITOR_GLOBALS = {
  browser: `${SHARED_TYPES}
/** Firestore (Firebase Web SDK, compat API). Security Rules apply. */
declare const db: StudioFirestore;
/** Firebase Auth for the connected project (signed-in user of the sandbox). */
declare const auth: any;
/** The Firebase compat namespace, e.g. firebase.firestore.FieldValue.serverTimestamp(). */
declare const firebase: any;
declare const app: any;
`,
  server: `${SHARED_TYPES}
/** Firestore (Firebase Admin SDK). Bypasses Security Rules. */
declare const db: StudioFirestore & { listCollections(): Promise<StudioCollectionReference[]>; getAll(...refs: StudioDocumentReference[]): Promise<StudioDocumentSnapshot[]> };
/** Admin helpers: admin.firestore.FieldValue, admin.auth(), admin.app … */
declare const admin: { app: any; firestore: any; auth(): any; FieldValue: any; FieldPath: any; Timestamp: any; GeoPoint: any };
/** Only variables allowed by EXECUTION_ENV_ALLOWLIST. */
declare const process: { env: Record<string, string | undefined>; version: string; platform: string };
declare const Buffer: any;
`,
};

let globalsDisposable = null;
let configured = false;

function configureMonaco(monaco, mode) {
  const js = monaco.languages.typescript.javascriptDefaults;
  if (!configured) {
    configured = true;
    js.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: false,
      lib: ["esnext"],
    });
    js.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
      // Scripts run as an async function body: top-level await and return are valid.
      diagnosticCodesToIgnore: [1108, 1375, 1378, 2304],
    });
    monaco.editor.defineTheme("studio-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#020617",
        "editorGutter.background": "#020617",
        "editor.lineHighlightBackground": "#0f172a",
        "editorLineNumber.foreground": "#475569",
      },
    });
  }
  if (mode) {
    globalsDisposable?.dispose();
    globalsDisposable = js.addExtraLib(EDITOR_GLOBALS[mode] || "", "ts:studio-globals.d.ts");
  }
}

/**
 * Monaco editor configured for Firebase scripts (language "javascript") or
 * Firestore documents (language "json").
 */
export function CodeEditor({ value, onChange, language = "javascript", mode, onRun, onSave, onReady, readOnly = false, errorLine, height = "100%", path }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const handlers = useRef({ onRun, onSave });
  handlers.current = { onRun, onSave };

  useEffect(() => {
    if (monacoRef.current && language === "javascript") configureMonaco(monacoRef.current, mode);
  }, [mode, language]);

  // Highlight the line a failing script reported.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    if (!errorLine || errorLine < 1 || errorLine > model.getLineCount()) {
      monaco.editor.setModelMarkers(model, "studio-runtime", []);
      return;
    }
    monaco.editor.setModelMarkers(model, "studio-runtime", [
      {
        startLineNumber: errorLine,
        endLineNumber: errorLine,
        startColumn: 1,
        endColumn: model.getLineMaxColumn(errorLine),
        message: "Script failed here",
        severity: monaco.MarkerSeverity.Error,
      },
    ]);
    editor.revealLineInCenterIfOutsideViewport(errorLine);
  }, [errorLine]);

  return (
    <MonacoEditor
      height={height}
      language={language}
      path={path}
      theme="studio-dark"
      value={value}
      onChange={(next) => onChange?.(next ?? "")}
      beforeMount={(monaco) => {
        monacoRef.current = monaco;
        configureMonaco(monaco, language === "javascript" ? mode : null);
      }}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handlers.current.onRun?.());
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handlers.current.onSave?.());
        onReady?.(editor);
      }}
      options={{
        readOnly,
        fontSize: 13,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: language === "json" ? "on" : "off",
        renderLineHighlight: "line",
        padding: { top: 12 },
        fixedOverflowWidgets: true,
      }}
    />
  );
}
