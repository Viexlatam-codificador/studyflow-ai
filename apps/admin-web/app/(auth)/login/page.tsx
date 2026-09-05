"use client";

import { useActionState } from "react";
import { login, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <h1 className="mb-1 text-2xl font-semibold">
          StudyFlow <span className="brand-gradient-text">Admin</span>
        </h1>
        <p className="mb-6 text-sm text-foreground/60">Acceso exclusivo para staff.</p>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Correo</span>
            <input
              name="email"
              type="email"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand-violet"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Contraseña</span>
            <input
              name="password"
              type="password"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand-violet"
            />
          </label>

          {state.error && <p className="text-sm text-brand-urgent">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="brand-gradient mt-2 rounded-full px-4 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {pending ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
