"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { toast } from "@/lib/store/studio-store";
import { Button, cn, inputClass } from "@/components/ui";

/**
 * Signs in to the *connected* Firebase project (not to Studio) so Security
 * Rules see an authenticated user. Passwords are sent straight to Firebase
 * Auth by the Web SDK and are never stored by Studio.
 */
export function ProjectAuthPanel({ controller, scopeLabel, className }) {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!controller) return undefined;
    setUser(null);
    return controller.subscribe(setUser);
  }, [controller]);

  async function act(kind, fn) {
    setBusy(kind);
    try {
      await fn();
      if (kind === "password") {
        setPassword("");
        setShowForm(false);
      }
    } catch (error) {
      toast(error.code ? `${error.code}: ${error.message}` : error.message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (!controller) return null;

  return (
    <div className={cn("rounded-lg border border-slate-800 bg-slate-950 p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Project auth</div>
        {scopeLabel ? <div className="text-[11px] text-slate-600">{scopeLabel}</div> : null}
      </div>

      {user ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0">
              <div className="truncate text-sm text-slate-200">{user.isAnonymous ? "Anonymous user" : user.email || user.uid}</div>
              <div className="truncate font-mono text-[11px] text-slate-500">{user.uid}</div>
            </div>
          </div>
          <Button size="xs" variant="ghost" icon={LogOut} loading={busy === "out"} onClick={() => act("out", controller.signOut)}>
            Sign out
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Not signed in. Requests are evaluated by Security Rules as unauthenticated.</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" loading={busy === "anon"} onClick={() => act("anon", controller.signInAnonymously)}>
              Anonymous
            </Button>
            <Button size="xs" icon={LogIn} onClick={() => setShowForm((value) => !value)}>
              Email
            </Button>
          </div>
          {showForm ? (
            <form
              className="space-y-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                act("password", () => controller.signInWithPassword(email, password));
              }}
            >
              <input className={cn(inputClass, "py-1.5 text-xs")} type="email" placeholder="user@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" required />
              <input className={cn(inputClass, "py-1.5 text-xs")} type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" required />
              <Button type="submit" size="xs" variant="primary" loading={busy === "password"} className="w-full">
                Sign in to project
              </Button>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
