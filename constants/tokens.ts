/**
 * Me&u design tokens — a direct transcription of the `tokens.json` block in the
 * design system doc. Nothing here is invented: the spec says "never invent new
 * hues at implementation time", so every value below traces back to that file.
 *
 * Screens must not import this module directly — go through `useTheme()` so the
 * dark palette can be switched on later without touching a single screen.
 */

import { Platform } from 'react-native';

export const palette = {
  brand: {
    rose: '#F0546F',
    rosePressed: '#D63C58',
    roseSoft: '#FFE6EA',
    iris: '#6E5AC8',
    irisSoft: '#EEEAFB',
    amber: '#F5A524',
    amberSoft: '#FFF1D6',
  },
  person: {
    you: '#F0546F',
    partner: '#6E5AC8',
  },
  mood: {
    happy: '#F5B93A',
    neutral: '#A9A2B3',
    sad: '#7E9BD4',
    stressed: '#E4795F',
  },
  light: {
    bgBase: '#FBF8FA',
    surface: '#FFFFFF',
    surfaceSunken: '#F4EFF4',
    textPrimary: '#221A2B',
    textSecondary: '#7B7286',
    textTertiary: '#A9A2B3',
    border: '#EDE6EC',
    success: '#3B7F5C',
    danger: '#D94A4A',
  },
  dark: {
    bgBase: '#161119',
    surface: '#211A28',
    surfaceSunken: '#1B1521',
    textPrimary: '#F6F1F7',
    textSecondary: '#B4AAB9',
    textTertiary: '#847A8B',
    border: '#2E2536',
    success: '#5FB183',
    danger: '#F0787A',
  },
} as const;

/**
 * Gradients are CSS strings for `experimental_backgroundImage` (New Arch only,
 * which this app enables). Deliberately NOT expo-linear-gradient.
 */
export const gradients = {
  wash: 'linear-gradient(180deg,#FCEFF3,#FBF8FA 34%)',
  washDark: 'linear-gradient(180deg,#241A2A,#161119 34%)',
  coin: 'linear-gradient(135deg,#F5A524,#F0546F)',
  premium: 'linear-gradient(135deg,#6E5AC8,#3F3161)',
  brandCta: 'linear-gradient(180deg,#F0546F,#D63C58)',
  xp: 'linear-gradient(90deg,#F5A524,#F0546F)',
} as const;

/** Tab-bar colours. Spec: active rose, inactive #C4BAC9. */
export const tabColors = {
  active: '#F0546F',
  inactive: '#C4BAC9',
  /**
   * Frosted tab-bar fill, layered over the blur on iOS.
   *
   * The two platforms need different alphas because they are doing different
   * things. iOS already has a UIBlurEffect underneath, so the tint only has to
   * warm it toward the wash — push the alpha up and it flattens back into a
   * solid bar. Android's Material 3 bottom nav has no blur primitive at all, so
   * the alpha is the entire effect there and has to stay high enough that
   * scrolling cards behind it don't fight the labels.
   */
  glass: Platform.select({
    ios: 'rgba(251,248,250,0.55)',
    android: 'rgba(251,248,250,0.88)',
    default: 'rgba(251,248,250,0.72)',
  }),
  glassDark: Platform.select({
    ios: 'rgba(22,17,25,0.55)',
    android: 'rgba(22,17,25,0.88)',
    default: 'rgba(22,17,25,0.72)',
  }),
  /** Plum-tinted hairline above the bar, never neutral black. */
  glassHairline: 'rgba(34,26,43,0.06)',
  /** Android press ripple — rose at low alpha, matching the active tint. */
  ripple: 'rgba(240,84,111,0.12)',
} as const;

/**
 * Height the native tab bar occupies, *excluding* the bottom safe-area inset.
 *
 * SDK 54's NativeTabs publishes neither content insets nor a height hook — it
 * wraps its screens in nothing at all — so scrollable routes have to pad by
 * hand. See `useChromeInsets`. Values are the platform defaults: UITabBar's
 * standard height on iOS, Material 3's NavigationBar height on Android.
 */
export const tabBarHeight = Platform.select({ ios: 49, android: 80, default: 56 });

/**
 * Toast fills. Not from the tokens doc — the spec predates the component.
 *
 * The text on these is always white, so each value has to clear 4.5:1 against
 * it. `success` and `iris` do already and are reused unchanged; `light.danger`
 * (#D94A4A) lands at about 4.2:1, so the red here is a darkened version of it
 * rather than the semantic token. Do not "fix" that back to `light.danger` —
 * it is the one value that fails.
 */
export const toastColors = {
  success: palette.light.success, // ~4.8:1 on white
  error: '#B93A3A', // darkened from light.danger — ~5.6:1
  info: palette.brand.iris, // ~5.3:1
  foreground: '#FFFFFF',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 44,
} as const;

/** Screen gutter is 20 on both platforms; cards sit 12 apart vertically. */
export const gutter = 20;
export const cardGap = 12;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
  sheetIos: 30,
  sheetAndroid: 20,
} as const;

/**
 * CSS boxShadow strings — never legacy shadowOffset/elevation.
 * Shadows are plum- or rose-tinted, never neutral black.
 */
export const shadow = {
  s1: '0 3px 14px rgba(34,26,43,0.05)',
  s2: '0 4px 18px rgba(34,26,43,0.06)',
  brand: '0 12px 28px rgba(240,84,111,0.30)',
  iris: '0 12px 28px rgba(110,90,200,0.28)',
} as const;

export const motion = {
  tap: { ms: 120 },
  screen: { ms: 260 },
  sheet: { ms: 320 },
  reward: { ms: 420, overshoot: 0.04 },
  coin: { ms: 1150 },
  wheel: { ms: 1400 },
} as const;

/**
 * Reanimated Easing tuples matching the motion curves in the spec.
 * Consumed as `Easing.bezier(...curve.coin)`.
 */
export const curve = {
  screen: [0.2, 0.8, 0.2, 1] as const,
  coin: [0.2, 0.85, 0.2, 1] as const,
  wheel: [0.15, 0.85, 0.2, 1] as const,
};

/**
 * Icon sizes and stroke.
 *
 * Not from the tokens doc — that spec predates the icon set, which was emoji at
 * the time. Sizes are tokens rather than per-call numbers so strokes stay
 * optically even; `stroke` is deliberately single-valued, since mixing widths
 * inside one layer is the fastest way to make a vector set look assembled from
 * scraps.
 */
export const icon = {
  sm: 18,
  md: 24,
  lg: 28,
  stroke: 2,
} as const;

export const layout = {
  ios: { minTarget: 44 },
  android: { minTarget: 48 },
  /** Built to the larger of the two everywhere, per the spec. */
  minTarget: 48,
} as const;

/**
 * Font families resolve to the names registered by `useFonts` in the root layout.
 * `tracking` is an em ratio in the spec, so callers multiply by font size.
 */
export const fontFamily = {
  display: {
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
  },
  body: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
  },
} as const;

export type TextRole =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'cardTitle'
  | 'button'
  | 'bodyStrong'
  | 'body'
  | 'caption'
  | 'overline';

type TypeSpec = {
  fontFamily: string;
  fontSize: number;
  /** em ratio from the spec; converted to letterSpacing at render time. */
  tracking?: number;
  lineHeight?: number;
  uppercase?: boolean;
};

export const typeScale: Record<TextRole, TypeSpec> = {
  display: { fontFamily: fontFamily.display.extrabold, fontSize: 38, tracking: -0.03 },
  title1: { fontFamily: fontFamily.display.bold, fontSize: 27, tracking: -0.02 },
  title2: { fontFamily: fontFamily.display.bold, fontSize: 24, tracking: -0.02 },
  title3: { fontFamily: fontFamily.display.bold, fontSize: 19 },
  cardTitle: { fontFamily: fontFamily.display.bold, fontSize: 14 },
  button: { fontFamily: fontFamily.body.bold, fontSize: 15 },
  bodyStrong: { fontFamily: fontFamily.body.semibold, fontSize: 14 },
  body: { fontFamily: fontFamily.body.regular, fontSize: 14, lineHeight: 14 * 1.55 },
  caption: { fontFamily: fontFamily.body.regular, fontSize: 12 },
  overline: { fontFamily: fontFamily.body.bold, fontSize: 10, tracking: 0.06, uppercase: true },
};

export const tabs = ['home', 'coach', 'calendar', 'you'] as const;
export const homeSegments = ['today', 'us', 'play'] as const;
