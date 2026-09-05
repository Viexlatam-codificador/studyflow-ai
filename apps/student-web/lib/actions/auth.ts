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
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/onboarding");
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
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
