import { getOnboardingData } from "@/lib/actions/onboarding";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const data = await getOnboardingData();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="mb-2 text-3xl font-semibold">Bienvenido a StudyFlow</h1>
      <p className="mb-8 text-foreground/60">
        Cuéntanos dónde estudias — toma menos de 3 minutos y luego puedes crear tu primera tarea.
      </p>
      <OnboardingForm data={data} />
    </div>
  );
}
