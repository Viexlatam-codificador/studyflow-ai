import Link from "next/link";
import { getStudyProfile, listSubjectConfidence } from "@/lib/data/study-profile";
import { ProfileForm } from "./profile-form";
import { ConfidenceList } from "./confidence-list";

export default async function StudyProfilePage() {
  const [profile, confidence] = await Promise.all([getStudyProfile(), listSubjectConfidence()]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <Link href="/study" className="text-sm text-foreground/50 hover:text-foreground">
          ← Volver a Estudiar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Mi perfil de estudio</h1>
        <p className="text-foreground/60">
          Esto ayuda a StudyFlow a armar tu plan — puedes saltarlo, corregirlo o borrarlo cuando quieras. Nada
          aquí es un diagnóstico: son preferencias que tú declaras.
        </p>
      </div>

      <ProfileForm initial={profile} />

      <div>
        <h2 className="mb-1 text-lg font-semibold">Confianza por asignatura</h2>
        <p className="mb-3 text-sm text-foreground/60">
          De 1 (poca confianza) a 5 (mucha). Es lo que tú declaras — StudyFlow muestra aparte lo que reportas
          después de cada sesión, sin mezclarlos.
        </p>
        <ConfidenceList subjects={confidence} />
      </div>
    </div>
  );
}
