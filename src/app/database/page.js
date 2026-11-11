import { StudioShell } from "@/components/studio-shell";

const collections = ["students", "courses", "attendance", "settings"];

const documents = [
  { id: "STUDENT_102", name: "Aarav Sharma", status: "active" },
  { id: "STUDENT_203", name: "Maya Chen", status: "pending" },
  { id: "STUDENT_305", name: "Ishaan Rao", status: "active" },
];

export default function DatabasePage() {
  return (
    <StudioShell title="Database explorer" subtitle="Inspect Firestore documents, collections and nested JSON safely from the connected Firebase project.">
      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Collections</h2>
            <button className="text-sm text-sky-300">New</button>
          </div>
          <div className="space-y-2">
            {collections.map((collection) => (
              <button
                key={collection}
                className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-left text-slate-200 transition hover:border-slate-700"
              >
                <span>{collection}</span>
                <span className="text-xs text-slate-400">24 docs</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Documents</h2>
              <div className="flex gap-2">
                <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">Add</button>
                <button className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">Export</button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left">Document ID</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="text-slate-200">
                      <td className="px-4 py-3">{doc.id}</td>
                      <td className="px-4 py-3">{doc.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                          {doc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 text-lg font-semibold text-white">Document preview</div>
            <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-300">
{`{
  "studentId": "STUDENT_102",
  "name": "Aarav Sharma",
  "status": "active",
  "subjects": ["Math", "Physics"],
  "profile": {
    "year": 2,
    "mentor": "Dr. Raman"
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
