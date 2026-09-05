import Link from "next/link";

const FEATURES = [
  {
    title: "StudyFlow Inbox",
    body: "Escribe, sube una foto de la pizarra o cuenta lo que dijo el profesor. StudyFlow detecta la tarea y te la muestra antes de guardarla — nunca sin tu confirmación.",
  },
  {
    title: "Planificador IA",
    body: "Prioriza tus tareas según urgencia, peso de nota, dificultad y el tiempo que realmente tienes disponible.",
  },
  {
    title: "Tutor con tus materiales",
    body: "Chatea con IA sobre tus propios apuntes y documentos, con las fuentes citadas.",
  },
  {
    title: "Tengo X minutos",
    body: "Dile a StudyFlow cuánto tiempo tienes y te dice exactamente qué avanzar ahora, y por qué.",
  },
];

const PLANS = [
  { name: "Free", price: "$0", tagline: "Organiza tus asignaturas y tareas manuales.", cta: "Comenzar gratis" },
  { name: "Pro", price: "$9.99/mes", tagline: "IA, planificador inteligente y tutor.", cta: "Elegir Pro", featured: true },
  { name: "Campus", price: "Institucional", tagline: "Licenciamiento por institución.", cta: "Hablemos" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">
          StudyFlow <span className="brand-gradient-text">AI</span>
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-foreground/70 hover:text-foreground">
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="brand-gradient rounded-full px-4 py-2 font-medium text-white transition-opacity hover:opacity-90"
          >
            Comenzar gratis
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-6 py-16">
        <section className="flex flex-col items-start gap-6">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Tu estudio, <span className="brand-gradient-text">organizado por IA.</span>
          </h1>
          <p className="max-w-xl text-lg text-foreground/70">
            Reúne tus clases, tareas, documentos y evaluaciones. StudyFlow te dice qué hacer,
            cuándo hacerlo y te ayuda a avanzar.
          </p>
          <div className="flex gap-4">
            <Link
              href="/signup"
              className="brand-gradient rounded-full px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
            >
              Comenzar gratis
            </Link>
            <Link
              href="#como-funciona"
              className="rounded-full border border-border px-6 py-3 font-medium hover:bg-card"
            >
              Ver cómo funciona
            </Link>
          </div>
        </section>

        <section id="como-funciona" className="grid gap-8 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-foreground/70">{f.body}</p>
            </div>
          ))}
        </section>

        <section id="planes" className="flex flex-col gap-6">
          <h2 className="text-2xl font-semibold">Planes</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`flex flex-col gap-3 rounded-2xl border p-6 ${
                  p.featured ? "border-brand-violet bg-card" : "border-border bg-card"
                }`}
              >
                <span className="text-sm font-medium text-foreground/60">{p.name}</span>
                <span className="text-2xl font-semibold">{p.price}</span>
                <p className="text-sm text-foreground/70">{p.tagline}</p>
                <Link
                  href="/signup"
                  className={`mt-2 rounded-full px-4 py-2 text-center text-sm font-medium ${
                    p.featured ? "brand-gradient text-white" : "border border-border"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-foreground/50">
        StudyFlow AI — Founder &amp; Creator: Nicolás Leiva
      </footer>
    </div>
  );
}
