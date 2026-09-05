/**
 * Motivational messages shown on the dashboard. Original phrasing inspired
 * by themes of purpose, perseverance and hope — written fresh in a youthful
 * Chilean tone, not verbatim quotes from any copyrighted translation.
 */
export interface MotivationalMessage {
  text: string;
  emoji: string;
}

const GENERAL_MESSAGES: MotivationalMessage[] = [
  { text: "Acuérdate por qué partiste. Ese objetivo sigue esperándote al final del semestre.", emoji: "🌱" },
  { text: "No tienes que hacerlo perfecto hoy, solo tienes que seguir avanzando.", emoji: "🚶" },
  { text: "Lo que siembras esta semana, lo cosechas en la prueba. Un poquito cada día basta.", emoji: "🌾" },
  { text: "Cansarse es normal. Rendirse es una decisión — y hoy no la vas a tomar.", emoji: "💪" },
  { text: "Tu esfuerzo de hoy no se pierde, aunque no lo veas altiro.", emoji: "✨" },
  { text: "No estás solo/a en esto. Pide ayuda cuando la necesites, es de sabios.", emoji: "🤝" },
  { text: "Todo tiene su momento: hoy toca estudiar, después toca descansar. Ninguno sobra.", emoji: "⏳" },
  { text: "Una tarea a la vez. Así se mueven las montañas.", emoji: "⛰️" },
  { text: "Confía en el proceso — el que siembra con paciencia, cosecha con alegría.", emoji: "🌻" },
  { text: "Tu constancia de hoy es el resultado que vas a agradecer en un mes.", emoji: "🔥" },
];

const STREAK_MESSAGES: MotivationalMessage[] = [
  { text: "Vas bien. No pierdas el foco de por qué empezaste — ya llevas más de lo que crees.", emoji: "🚀" },
  { text: "Cada día que sigues es una prueba de que puedes más de lo que pensabas.", emoji: "🏆" },
  { text: "La racha no es suerte, es disciplina. Sigue así.", emoji: "🔥" },
];

const COMEBACK_MESSAGES: MotivationalMessage[] = [
  { text: "Volviste — eso ya dice mucho de ti. Empecemos por lo más simple de hoy.", emoji: "🌤️" },
  { text: "No importa cuánto tiempo pasó, lo que importa es el paso de hoy.", emoji: "🌅" },
];

export function getMotivationalMessage(context: { streakDays?: number; daysSinceLastActive?: number }): MotivationalMessage {
  const pool =
    context.streakDays && context.streakDays >= 3
      ? STREAK_MESSAGES
      : context.daysSinceLastActive && context.daysSinceLastActive >= 3
        ? COMEBACK_MESSAGES
        : GENERAL_MESSAGES;

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  return pool[dayOfYear % pool.length];
}
