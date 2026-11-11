import { Suspense } from "react";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata = { title: "Sign in · Firebase Studio" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-lg font-bold text-white shadow-lg shadow-orange-500/20">
            F
          </div>
          <h1 className="text-xl font-semibold text-white">Sign in to Firebase Studio</h1>
          <p className="mt-1 text-sm text-slate-400">Only trusted operators can run scripts against connected projects.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
