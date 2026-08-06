import { createContext, use, type ReactNode } from 'react';

import { gradients, palette } from '@/constants/tokens';

/**
 * Light-only for now, dark-ready by construction.
 *
 * The dark palette is fully transcribed in tokens.ts and the shape below is
 * identical for both modes, so enabling dark mode later is a one-line change
 * here (read `useColorScheme()` and pick the other branch) — no screen edits.
 */
export type ThemeScheme = 'light' | 'dark';

/** Widened from the token literals so both palettes satisfy one shape. */
export type SemanticColors = { -readonly [K in keyof typeof palette.light]: string };

export type Theme = {
  scheme: ThemeScheme;
  color: SemanticColors;
  brand: typeof palette.brand;
  person: typeof palette.person;
  mood: typeof palette.mood;
  /** Screen background wash, as a CSS gradient string. */
  wash: string;
};

function buildTheme(scheme: ThemeScheme): Theme {
  return {
    scheme,
    color: scheme === 'dark' ? palette.dark : palette.light,
    brand: palette.brand,
    person: palette.person,
    mood: palette.mood,
    wash: scheme === 'dark' ? gradients.washDark : gradients.wash,
  };
}

const lightTheme = buildTheme('light');

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Intentionally pinned to light. Swap for `useColorScheme()` to enable dark.
  return <ThemeContext value={lightTheme}>{children}</ThemeContext>;
}

export function useTheme(): Theme {
  return use(ThemeContext);
}
