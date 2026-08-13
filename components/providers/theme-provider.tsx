import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { gradients, palette, tabColors, tints } from '@/constants/tokens';

export type ThemeScheme = 'light' | 'dark';

/** `system` follows the OS; the other two are the user overriding it. */
export type ThemePreference = 'system' | ThemeScheme;

/** Widened from the token literals so both palettes satisfy one shape. */
export type SemanticColors = { -readonly [K in keyof typeof palette.light]: string };

type TintSet = { bg: string; fg: string; muted: string };
export type Tints = { -readonly [K in keyof typeof tints.light]: TintSet };

export type Theme = {
  scheme: ThemeScheme;
  color: SemanticColors;
  /** Soft surfaces and the ink that stays legible on them. */
  tint: Tints;
  brand: typeof palette.brand;
  person: typeof palette.person;
  mood: typeof palette.mood;
  /** Screen background wash, as a CSS gradient string. */
  wash: string;
  /** Frosted tab-bar fill for this scheme. */
  tabGlass: string;
  /** iOS blur material name matching the scheme. */
  tabBlur: 'systemChromeMaterialLight' | 'systemChromeMaterialDark';
};

type ThemeApi = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  /** Flips to the opposite of whatever is on screen, as an explicit choice. */
  toggle: () => void;
};

const STORAGE_KEY = 'meyou.theme-preference';

function buildTheme(scheme: ThemeScheme): Theme {
  const dark = scheme === 'dark';

  return {
    scheme,
    color: dark ? palette.dark : palette.light,
    tint: dark ? tints.dark : tints.light,
    brand: palette.brand,
    person: palette.person,
    mood: palette.mood,
    wash: dark ? gradients.washDark : gradients.wash,
    tabGlass: (dark ? tabColors.glassDark : tabColors.glass) as string,
    tabBlur: dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
  };
}

const lightTheme = buildTheme('light');
const darkTheme = buildTheme('dark');

const ThemeContext = createContext<Theme>(lightTheme);
const ThemeApiContext = createContext<ThemeApi>({
  preference: 'system',
  setPreference: () => {},
  toggle: () => {},
});

/**
 * Light and dark, with the choice remembered.
 *
 * Three states, not two: `system` is the default and the only one that tracks
 * the OS, and a user who flips the header toggle is choosing to stop following
 * it. Collapsing that to a boolean would mean someone who set dark at night is
 * still in dark when their phone goes light in the morning — with no way to say
 * "go back to matching my phone" short of reinstalling.
 *
 * Renders nothing until the stored preference is read. The splash screen is
 * still up at that point (the root layout is also waiting on fonts), and the
 * alternative is painting the whole app light and snapping to dark a frame
 * later, on every cold start, for every dark-mode user.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!active) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
      setRestored(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    // Optimistic: the write is a local disk operation whose only failure mode
    // is the choice not surviving a restart, which is not worth blocking a
    // theme change on.
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const scheme: ThemeScheme = preference === 'system' ? (system ?? 'light') : preference;

  const toggle = useCallback(() => {
    setPreference(scheme === 'dark' ? 'light' : 'dark');
  }, [scheme, setPreference]);

  if (!restored) return null;

  return (
    <ThemeContext value={scheme === 'dark' ? darkTheme : lightTheme}>
      <ThemeApiContext value={{ preference, setPreference, toggle }}>{children}</ThemeApiContext>
    </ThemeContext>
  );
}

export function useTheme(): Theme {
  return use(ThemeContext);
}

/** Separate from `useTheme` so reading colours does not subscribe to the API. */
export function useThemeControls(): ThemeApi {
  return use(ThemeApiContext);
}
