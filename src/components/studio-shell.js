import Link from "next/link";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "▣" },
  { href: "/connections", label: "Connections", icon: "⎇" },
  { href: "/database", label: "Database", icon: "◫" },
  { href: "/playground", label: "Playground", icon: "⌘" },
  { href: "/scripts", label: "Scripts", icon: "✦" },
  { href: "/history", label: "History", icon: "◔" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function StudioShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#020817] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-950/80 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-orange-500/30">
              F
            </div>
            <div>
              <div className="text-lg font-semibold">Firebase Studio</div>
              <div className="text-xs text-slate-400">Dev workspace</div>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs text-orange-300">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-slate-800 p-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <div className="text-emerald-300">Secure mode</div>
              <div className="mt-1 text-xs text-slate-300">Browser + Admin execution split</div>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-orange-300/80">Studio</p>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm md:block">
                  projects/aurora-app
                </div>
                <button className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                  Run
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 font-semibold text-slate-950">
                  A
                </div>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6">
            {subtitle ? (
              <p className="mb-6 max-w-3xl text-sm text-slate-300">{subtitle}</p>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
