import Link from "next/link";

const features = [
  {
    title: "JavaScript Playground",
    description: "Run client or server-side Firebase scripts in a secure workspace with console output and logs.",
  },
  {
    title: "Firestore Explorer",
    description: "Browse collections, inspect documents, edit records, and build queries without leaving the app.",
  },
  {
    title: "Secure Connections",
    description: "Connect Firebase projects with Web SDK config or Admin SDK credentials while keeping studio data isolated.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-600 text-lg font-bold text-white">
              F
            </div>
            <div>
              <div className="text-xl font-semibold">Firebase Studio</div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Developer workspace</div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Open dashboard
          </Link>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-orange-300">
              Code. Execute. Manage.
            </p>
            <h1 className="max-w-2xl text-5xl font-black tracking-tight text-white sm:text-6xl">
              A browser-based Firebase development environment.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Firebase Studio lets developers connect projects, write JavaScript against Firestore, run secure scripts and explore database content from a single dashboard.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/playground"
                className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-3 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:opacity-95"
              >
                Launch playground
              </Link>
              <Link
                href="/connections/new"
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                Add Firebase project
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
            <div className="mb-5">
              <div className="text-sm text-slate-400">How it works</div>
              <div className="text-xl font-semibold text-white">Two engines, one workspace</div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Execution engine</div>
                <div className="mt-2 text-lg font-semibold text-white">Browser sandbox + isolated Node.js worker</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Security model</div>
                <div className="mt-2 text-lg font-semibold text-white">Encrypted Admin credentials, never sent to the browser</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Workspace</div>
                <div className="mt-2 text-lg font-semibold text-white">Dashboard · Explorer · Script history</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-8 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Capabilities</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Built for Firebase workflows</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 text-xl text-sky-300">
                  ✦
                </div>
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
