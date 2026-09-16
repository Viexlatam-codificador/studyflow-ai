import Link from "next/link";
import { getAvailability } from "@/lib/data/availability";
import { BlocksSection } from "./blocks-section";
import { ExceptionsSection } from "./exceptions-section";
import { SettingsSection } from "./settings-section";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function AvailabilityPage() {
  const availability = await getAvailability();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <Link href="/study" className="text-sm text-foreground/50 hover:text-foreground">
          ← Volver a Estudiar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Mi disponibilidad</h1>
        <p className="text-foreground/60">
          StudyFlow solo agenda sesiones dentro de las ventanas que marques como &ldquo;tiempo para estudiar&rdquo;.
          Una hora vacía no cuenta como disponible si no la declaras.
        </p>
      </div>

      <SettingsSection settings={availability.settings} />
      <BlocksSection blocks={availability.blocks} weekdayLabels={WEEKDAY_LABELS} />
      <ExceptionsSection exceptions={availability.exceptions} />
    </div>
  );
}
