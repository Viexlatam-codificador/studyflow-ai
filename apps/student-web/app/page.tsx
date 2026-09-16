import Link from "next/link";

const FEATURES = [
  {
    title: "StudyFlow Inbox",
    body: "Escribe, sube una foto de la pizarra o de tus apuntes. StudyFlow detecta la tarea y te la muestra antes de guardarla — nunca sin tu confirmación.",
  },
  {
    title: "Plan semanal explicado",
    body: "Un motor gratuito (sin IA) revisa tus pendientes, tu disponibilidad real y tu nivel declarado, y te propone sesiones concretas para los próximos días — con el motivo de cada prioridad.",
  },
  {
    title: "Tengo X minutos",
    body: "Dile a StudyFlow cuánto tiempo tienes ahora mismo y te sugiere un paso pequeño y concreto, no solo el nombre de la tarea.",
  },
  {
    title: "Personaliza con tu Gemini",
    body: "Copia un contexto compacto, pégalo en tu propia cuenta de Gemini, y trae su respuesta de vuelta — StudyFlow decide dónde ubicarla en tu plan. Nunca te pedimos tu contraseña ni accedemos a tu cuenta de Google.",
  },
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
            Un plan de estudio <span className="brand-gradient-text">hecho para ti,</span> no solo un calendario.
          </h1>
          <p className="max-w-xl text-lg text-foreground/70">
            Reúne tus tareas y evaluaciones, dinos tu disponibilidad real, y StudyFlow convierte eso en sesiones
            concretas para esta semana — qué estudiar, cuándo, y por qué es prioridad. Gratis, sin tarjeta, sin
            necesitar configurar ninguna IA.
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
          <p className="text-xs text-foreground/40">
            StudyFlow no promete que vas a terminar todo ni que vas a aprobar — te muestra tu carga real y te
            ayuda a decidir qué hacer con el tiempo que tienes.
          </p>
        </section>

        <section id="como-funciona" className="grid gap-8 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-foreground/70">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 text-xl font-semibold">Qué hace StudyFlow y qué haces tú en Gemini</h2>
          <p className="text-sm text-foreground/70">
            StudyFlow organiza tus tareas, calcula prioridades y arma tu plan semanal sin depender de ninguna IA
            — funciona completo aunque nunca uses la parte de Gemini. Si quieres una segunda opinión, StudyFlow
            prepara un resumen que tú copias y pegas en tu propia cuenta de Gemini; la respuesta la traes de
            vuelta y decides qué incorporar. StudyFlow nunca inicia sesión en Google por ti ni accede a tu cuenta.
          </p>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-foreground/50">
        StudyFlow AI — Founder &amp; Creator: Nicolás Leiva
      </footer>
    </div>
  );
}
