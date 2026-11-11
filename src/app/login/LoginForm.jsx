"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { api } from "@/lib/api/client";
import { Alert, Button, Field, inputClass } from "@/components/ui";

function safeNext(value) {
  // Only allow same-site relative paths to avoid open redirects.
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: { password } });
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field label="Password" hint="Set with STUDIO_PASSWORD in .env.local">
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Button type="submit" variant="primary" icon={LogIn} loading={busy} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
