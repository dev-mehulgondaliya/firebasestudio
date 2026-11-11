"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Code2,
  Database,
  FileCode2,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PlugZap,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useStudioStore } from "@/lib/store/studio-store";
import { api } from "@/lib/api/client";
import { cn, Toaster } from "@/components/ui";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/connections", label: "Connections", icon: PlugZap },
  { href: "/database", label: "Database", icon: Database },
  { href: "/playground", label: "Playground", icon: Code2 },
  { href: "/scripts", label: "Scripts", icon: FileCode2 },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-sm font-bold text-white shadow-lg shadow-orange-500/20">
        F
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">Firebase Studio</div>
        <div className="text-[11px] text-slate-500">Code · Execute · Manage</div>
      </div>
    </div>
  );
}

function Sidebar({ user, onNavigate }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b border-slate-800 px-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-orange-400" : "text-slate-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-slate-800 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>Credentials stay server-side</span>
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="truncate text-sm text-slate-200">{user?.email || "Owner"}</div>
            <div className="text-[11px] text-slate-500">Signed in</div>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function StudioShell({ user, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    useStudioStore.persist.rehydrate();
    useStudioStore.getState().loadConnections();
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <aside className="hidden w-60 shrink-0 border-r border-slate-800 bg-slate-950 lg:block">
        <Sidebar user={user} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/80" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-950">
            <button
              type="button"
              className="absolute right-2 top-3 rounded-md p-2 text-slate-400 hover:bg-slate-800"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar user={user} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-3 border-b border-slate-800 px-3 lg:hidden">
          <button
            type="button"
            className="rounded-md p-2 text-slate-300 hover:bg-slate-800"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </div>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
