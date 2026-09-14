"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const SignupSchema = z.object({
  name: z.string().min(2, { error: "Tu nombre debe tener al menos 2 caracteres." }).trim(),
  email: z.email({ error: "Ingresa un correo válido." }).trim(),
  password: z
    .string()
    .min(8, { error: "La contraseña debe tener al menos 8 caracteres." })
    .regex(/[a-zA-Z]/, { error: "Debe contener al menos una letra." })
    .regex(/[0-9]/, { error: "Debe contener al menos un número." }),
});

const LoginSchema = z.object({
  email: z.email({ error: "Ingresa un correo válido." }).trim(),
  password: z.string().min(1, { error: "Ingresa tu contraseña." }),
});

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  needsConfirmation?: boolean;
  confirmationEmail?: string;
}

function friendlyAuthError(code: string | undefined, message: string): string {
  switch (code) {
    case "over_email_send_rate_limit":
      return "Estamos recibiendo muchas solicitudes de registro en este momento. Espera unos minutos e inténtalo de nuevo — no es un error tuyo.";
    case "user_already_exists":
      return "Ya existe una cuenta con ese correo. Intenta iniciar sesión en vez de registrarte.";
    case "weak_password":
      return "Esa contraseña es muy débil. Usa al menos 8 caracteres con letras y números.";
    case "email_not_confirmed":
      return "Tu cuenta aún no está confirmada. Revisa tu correo (y spam) o reenvía el enlace de confirmación abajo.";
    default:
      return message;
  }
}

export async function signup(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    return { error: friendlyAuthError(error.code, error.message) };
  }

  // Supabase requires email confirmation before a session is usable — if no
  // session came back, the account was created but is waiting on that email.
  if (!data.session) {
    return { needsConfirmation: true, confirmationEmail: parsed.data.email };
  }

  redirect("/onboarding");
}

export async function resendConfirmation(email: string): Promise<AuthFormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    return { error: friendlyAuthError(error.code, error.message), needsConfirmation: true, confirmationEmail: email };
  }

  return { needsConfirmation: true, confirmationEmail: email };
}

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { needsConfirmation: true, confirmationEmail: parsed.data.email };
    }
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
