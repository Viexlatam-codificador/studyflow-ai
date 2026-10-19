import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const authorizationId = (await searchParams).authorization_id;
  if (!authorizationId) {
    return <ConsentError message="La solicitud de conexión no incluye un identificador válido." />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details) {
    return <ConsentError message={error?.message ?? "La solicitud ya no es válida o venció."} />;
  }
  if (!("authorization_id" in details)) redirect(details.redirect_url);

  const scopes = details.scope?.split(" ").filter(Boolean) ?? [];
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-brand-violet">Conexión segura de StudyFlow</p>
        <h1 className="text-2xl font-semibold">¿Conectar {details.client.name}?</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/65">
          Esta conexión podrá leer tu perfil de estudio, tus próximos trabajos, tu plan semanal y la evidencia de
          tus sesiones para personalizar la tutoría. No puede modificar ni eliminar tus datos.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-background p-4 text-sm">
          <p className="font-medium">La IA podrá</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/70">
            <li>adaptar el tamaño y formato de las explicaciones;</li>
            <li>priorizar según tus fechas y tiempo disponible;</li>
            <li>usar resultados anteriores para proponerte práctica;</li>
            <li>comprobar lo aprendido con un ejercicio nuevo.</li>
          </ul>
          {scopes.length > 0 && (
            <p className="mt-3 text-xs text-foreground/50">Permisos técnicos solicitados: {scopes.join(", ")}</p>
          )}
        </div>

        <p className="mt-4 text-xs leading-5 text-foreground/50">
          Las preferencias son hipótesis revisables, no un diagnóstico sobre tu forma de aprender. Puedes negar la
          conexión ahora o revocarla después desde tu cuenta.
        </p>

        <form action="/api/oauth/decision" method="POST" className="mt-7 flex flex-col gap-3 sm:flex-row-reverse">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button
            type="submit"
            name="decision"
            value="approve"
            className="brand-gradient rounded-full px-5 py-2.5 font-medium text-white"
          >
            Conectar de forma segura
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="rounded-full border border-border px-5 py-2.5 font-medium"
          >
            Cancelar
          </button>
        </form>
      </section>
    </main>
  );
}

function ConsentError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">No se pudo abrir la conexión</h1>
        <p className="mt-3 text-sm text-foreground/60">{message}</p>
      </section>
    </main>
  );
}
