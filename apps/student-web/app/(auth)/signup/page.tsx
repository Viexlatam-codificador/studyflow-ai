"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <h1 className="mb-1 text-2xl font-semibold">Crea tu cuenta</h1>
        <p className="mb-6 text-sm text-foreground/60">Empieza a organizar tu estudio con IA.</p>

        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Nombre" name="name" type="text" errors={state.fieldErrors?.name} />
          <Field label="Correo" name="email" type="email" errors={state.fieldErrors?.email} />
          <Field label="Contraseña" name="password" type="password" errors={state.fieldErrors?.password} />

          {state.error && <p className="text-sm text-brand-urgent">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="brand-gradient mt-2 rounded-full px-4 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {pending ? "Creando cuenta…" : "Comenzar gratis"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground/60">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-brand-violet">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  errors,
}: {
  label: string;
  name: string;
  type: string;
  errors?: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required
        className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand-violet"
      />
      {errors?.map((e) => (
        <span key={e} className="text-xs text-brand-urgent">
          {e}
        </span>
      ))}
    </label>
  );
}
