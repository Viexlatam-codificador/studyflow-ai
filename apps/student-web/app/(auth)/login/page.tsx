"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, resendConfirmation, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [resendState, resendAction, resendPending] = useActionState(
    async (_prev: AuthFormState, email: string) => resendConfirmation(email),
    initialState
  );

  if (state.needsConfirmation) {
    const email = state.confirmationEmail ?? "";
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-3xl">📬</p>
          <h1 className="mb-2 mt-3 text-xl font-semibold">Confirma tu correo</h1>
          <p className="text-sm text-foreground/60">
            Tu cuenta <span className="font-medium text-foreground">{email}</span> aún no está confirmada. Revisa
            el correo que te enviamos al registrarte (y spam) y abre el enlace.
          </p>

          {resendState.error && <p className="mt-3 text-sm text-brand-urgent">{resendState.error}</p>}
          {resendState.needsConfirmation && !resendState.error && (
            <p className="mt-3 text-sm text-brand-violet">Correo reenviado.</p>
          )}

          <button
            disabled={resendPending}
            onClick={() => resendAction(email)}
            className="mt-5 rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {resendPending ? "Reenviando…" : "Reenviar correo"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <h1 className="mb-1 text-2xl font-semibold">Inicia sesión</h1>
        <p className="mb-6 text-sm text-foreground/60">Sigue avanzando en tus estudios.</p>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Correo</span>
            <input
              name="email"
              type="email"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand-violet"
            />
            {state.fieldErrors?.email?.map((e) => (
              <span key={e} className="text-xs text-brand-urgent">
                {e}
              </span>
            ))}
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

        <p className="mt-6 text-center text-sm text-foreground/60">
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="font-medium text-brand-violet">
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
