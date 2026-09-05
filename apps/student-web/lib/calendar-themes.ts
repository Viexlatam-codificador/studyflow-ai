export interface CalendarTheme {
  preset: string;
  imageUrl?: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  emoji: string;
  background: string;
  /** Text/border tone to use on top of this background — some are light, some dark. */
  mode: "light" | "dark";
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "aurora",
    label: "Aurora",
    emoji: "🌌",
    background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #C026D3 100%)",
    mode: "light",
  },
  {
    id: "sunset",
    label: "Atardecer",
    emoji: "🌅",
    background: "linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #EC4899 100%)",
    mode: "light",
  },
  {
    id: "ocean",
    label: "Océano",
    emoji: "🌊",
    background: "linear-gradient(135deg, #0EA5E9 0%, #06B6D4 50%, #14B8A6 100%)",
    mode: "light",
  },
  {
    id: "forest",
    label: "Bosque",
    emoji: "🌿",
    background: "linear-gradient(135deg, #16A34A 0%, #10B981 50%, #84CC16 100%)",
    mode: "light",
  },
  {
    id: "candy",
    label: "Candy",
    emoji: "🍬",
    background: "linear-gradient(135deg, #F0ABFC 0%, #C4B5FD 50%, #93C5FD 100%)",
    mode: "dark",
  },
  {
    id: "midnight",
    label: "Medianoche",
    emoji: "🌙",
    background: "linear-gradient(135deg, #111827 0%, #1F2937 60%, #4F46E5 100%)",
    mode: "light",
  },
];

export function resolveThemeBackground(theme: CalendarTheme | null | undefined): {
  background: string;
  mode: "light" | "dark";
} {
  if (theme?.imageUrl) {
    return { background: `url(${theme.imageUrl}) center/cover no-repeat`, mode: "light" };
  }
  const preset = THEME_PRESETS.find((p) => p.id === theme?.preset) ?? THEME_PRESETS[0];
  return { background: preset.background, mode: preset.mode };
}
