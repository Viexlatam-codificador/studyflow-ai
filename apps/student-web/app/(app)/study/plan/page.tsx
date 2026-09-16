import Link from "next/link";
import { getPlanForWeek } from "@/lib/data/study-plan";
import { getAvailability } from "@/lib/data/availability";
import { listOpenObservations } from "@/lib/data/observations";
import { RegenerateButton } from "./regenerate-button";
import { PlanItems } from "./plan-items";
import { ObservationsPanel } from "./observations-panel";

export default async function StudyPlanPage() {
  const [plan, availability, observations] = await Promise.all([getPlanForWeek(), getAvailability(), listOpenObservations()]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <Link href="/study" className="text-sm text-foreground/50 hover:text-foreground">
          ← Volver a Estudiar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Mi plan semanal</h1>
        <p className="text-foreground/60">
          Sesiones para los próximos días, generadas por el motor gratuito de StudyFlow — sin necesitar ninguna
          IA configurada.
        </p>
      </div>

      <ObservationsPanel observations={observations} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RegenerateButton />
        {plan && <p className="text-xs text-foreground/40">Generado {new Date(plan.generatedAt).toLocaleString("es-CL")}</p>}
      </div>

      {plan && plan.unassignedMinutes > 0 && (
        <div className="rounded-2xl border border-brand-warning/40 bg-brand-warning/10 p-4 text-sm">
          <p className="font-medium text-brand-warning">
            Quedaron ~{plan.unassignedMinutes} minutos de trabajo sin espacio esta semana.
          </p>
          <p className="mt-1 text-foreground/60">
            Puedes: abrir más &ldquo;tiempo para estudiar&rdquo; en{" "}
            <Link href="/study/availability" className="text-brand-violet hover:underline">
              Mi disponibilidad
            </Link>
            , reducir el alcance de alguna tarea, o aceptar que algo quedará para la próxima semana. StudyFlow no
            promete que todo se va a completar.
          </p>
        </div>
      )}

      {!plan ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-foreground/60">Todavía no tienes un plan para esta semana.</p>
          <p className="mt-1 text-xs text-foreground/40">
            Revisa tu{" "}
            <Link href="/study/availability" className="text-brand-violet hover:underline">
              disponibilidad
            </Link>{" "}
            y presiona &ldquo;Regenerar plan&rdquo;.
          </p>
        </div>
      ) : (
        <PlanItems items={plan.items} timezone={availability.settings.timezone} />
      )}
    </div>
  );
}
