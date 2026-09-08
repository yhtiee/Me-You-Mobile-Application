/**
 * Me&u design tokens — a direct transcription of the `tokens.json` block in the
 * design system doc. Nothing here is invented: the spec says "never invent new
 * hues at implementation time", so every value below traces back to that file.
 *
 * Screens must not import this module directly — go through `useTheme()` so the
 * dark palette can be switched on later without touching a single screen.
 */

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
 * Soft-tinted surfaces and the text that goes on them.
 *
 * These existed as hardcoded hexes scattered through the screens — `#3F3161`
 * on an iris card, `#B97400` on an amber one — which is exactly what made the
 * app light-only. A tint is a *pair* (a fill and the ink that stays legible on
 * it), and both halves have to change together with the scheme.
 *
 * Every light `fg` and `muted` clears 4.5:1 on its own `bg`. Two of the old
 * hardcoded values did not: `#B97400` on `amberSoft` is 3.4:1, so `muted`
 * there is darkened to `#8F5A00` (5.2:1). Do not put the old value back to
 * "match the streak badge" — fix the badge instead.
 */
export const tints = {
  light: {
    rose: { bg: '#FFE6EA', fg: '#A82F46', muted: '#8A5560' },
    iris: { bg: '#EEEAFB', fg: '#3F3161', muted: '#6B5C8E' },
    amber: { bg: '#FFF1D6', fg: '#7A4E00', muted: '#8F5A00' },
    success: { bg: '#E6F1EA', fg: '#2C6146', muted: '#4A7A62' },
    neutral: { bg: '#F4EFF4', fg: '#221A2B', muted: '#7B7286' },
  },
  dark: {
    // Dark tints are the same hue at low lightness, never the light value
    // dimmed: `#FFE6EA` at 20% opacity over a dark ground goes grey, and the
    // person→colour mapping the whole app runs on stops being readable.
    rose: { bg: '#3B1B24', fg: '#FFC2CE', muted: '#D3A3AD' },
    iris: { bg: '#241D3B', fg: '#CFC4FF', muted: '#A79BD6' },
    amber: { bg: '#38270A', fg: '#FFD79A', muted: '#D9B173' },
    success: { bg: '#16301F', fg: '#9BD9B5', muted: '#7FB899' },
    neutral: { bg: '#1B1521', fg: '#F6F1F7', muted: '#B4AAB9' },
  },
} as const;

/**
 * Play — per-game identity.
 *
 * The Play hub shows six games at once, so each needs to be recognisable by
 * colour before its label is read. Five soft tints could not carry that: `rose`
 * was doing double duty for the wheel *and* trivia in the old grid, which is
 * exactly why every tile looked the same.
 *
 * No hue here is invented. Every base traces back to a value already in this
 * file — `brand.amber`, `brand.rose`, `brand.iris`, `light.success`, and the
 * two mood hues (`mood.sad`, `mood.stressed`) that were already being used as
 * wheel segment fills. What is new is the *pairs*: a `bg`/`fg`/`muted` triple
 * per scheme for the two mood hues, which never had one, built to the same rule
 * the `tints` block above states — every `fg` and `muted` clears 4.5:1 on its
 * own `bg`. Measured ratios are in the comments; do not substitute a "close
 * enough" hex without re-checking, because these fills are the whole navigation
 * system of the hub.
 */
export const playTints = {
  light: {
    // Reused verbatim from `tints.light` — same hue, already verified.
    coin: { bg: '#FFF1D6', fg: '#7A4E00', muted: '#8F5A00' },
    wheel: { bg: '#FFE6EA', fg: '#A82F46', muted: '#8A5560' },
    date: { bg: '#EEEAFB', fg: '#3F3161', muted: '#6B5C8E' },
    growth: { bg: '#E6F1EA', fg: '#2C6146', muted: '#4A7A62' },
    // New pairs, built on `mood.sad` #7E9BD4. fg 7.0:1, muted 4.8:1.
    picker: { bg: '#E7EDF9', fg: '#2F4E85', muted: '#4C6899' },
    // New pairs, built on `mood.stressed` #E4795F. fg 5.7:1, muted 5.6:1.
    trivia: { bg: '#FCE8E2', fg: '#A03B22', muted: '#8D4A38' },
  },
  dark: {
    coin: { bg: '#38270A', fg: '#FFD79A', muted: '#D9B173' },
    wheel: { bg: '#3B1B24', fg: '#FFC2CE', muted: '#D3A3AD' },
    date: { bg: '#241D3B', fg: '#CFC4FF', muted: '#A79BD6' },
    growth: { bg: '#16301F', fg: '#9BD9B5', muted: '#7FB899' },
    // fg 9.5:1, muted 6.2:1 on their own bg.
    picker: { bg: '#1C2740', fg: '#BDD0F0', muted: '#94A9CC' },
    // fg 9.7:1, muted 6.7:1 on their own bg.
    trivia: { bg: '#3A1E15', fg: '#FFC0AB', muted: '#D6A08D' },
  },
} as const;

/**
 * Full-saturation accent per game — the wheel wedge, the progress fill, the
 * dot on a stat pill. Never a text colour on a light ground: `amber` on white
 * is about 2:1. Use `playTints[scheme][game].fg` for ink.
 */
export const playAccents = {
  coin: '#F5A524',
  wheel: '#F0546F',
  date: '#6E5AC8',
  picker: '#7E9BD4',
  trivia: '#E4795F',
  growth: '#3B7F5C',
} as const;

export type PlayGameKey = keyof typeof playAccents;

/**
 * Wheel wedge fills — a *darkened* run of the Play accents.
 *
 * These are not `playAccents` and must not be replaced with them. The wedges
 * carry their own labels in 13px white, which is body-sized text and therefore
 * owes 4.5:1; four of the six accents are nowhere near it (`coin` is 2.05:1
 * against white, `picker` 2.6:1, `trivia` 2.9:1, `wheel` 3.35:1). Each value
 * below is the same hue taken down until white clears, measured:
 *
 *   #D63C58 rose    4.52:1     #4E74B0 blue    4.72:1
 *   #6E5AC8 iris    5.30:1     #3B7F5C green   4.80:1
 *   #A35F00 amber   5.01:1     #B04E33 coral   5.27:1
 *
 * Six values so a wheel needs a seventh option before a colour repeats.
 */
export const wheelFills = [
  '#D63C58',
  '#6E5AC8',
  '#A35F00',
  '#4E74B0',
  '#3B7F5C',
  '#B04E33',
] as const;

/**
 * Gradients are CSS strings for `experimental_backgroundImage` (New Arch only,
 * which this app enables). Deliberately NOT expo-linear-gradient.
 */
export const gradients = {
  /**
   * The couple banner — the two person colours blended into one surface, which
   * is the whole idea the card exists to express.
   *
   * It starts at `rosePressed`, not `rose`. White text has to clear 4.5:1 and
   * `rose` only reaches 3.35:1, which would fail the 10px "TOGETHER" overline
   * sitting right where the gradient is reddest. `rosePressed` lands at 4.52:1
   * and `iris` at 5.30:1, so every label on this surface is legible at both
   * ends. Do not "brighten" the first stop back to `rose`.
   */
  duo: 'linear-gradient(135deg,#D63C58,#6E5AC8)',
  wash: 'linear-gradient(180deg,#FCEFF3,#FBF8FA 34%)',
  washDark: 'linear-gradient(180deg,#241A2A,#161119 34%)',

  /**
   * The Play hero — amber through rose into iris, the app's whole brand range
   * in one sweep. It is the only surface in Play that carries white text, which
   * is what sets the stops: `#A35F00` is a darkened `brand.amber` at 5.0:1 on
   * white, `#D63C58` is `rosePressed` at 4.5:1, `#6E5AC8` is `iris` at 5.3:1,
   * and the two interpolated midpoints land at 5.0:1 and 5.3:1. So every pixel
   * of the ramp clears 4.5:1 for white body text, not just the three stops.
   *
   * Do not "brighten" the first stop to `brand.amber` — #F5A524 is 2.05:1 on
   * white and takes the overline sitting over it with it.
   */
  play: 'linear-gradient(135deg,#A35F00,#D63C58 52%,#6E5AC8)',

  /**
   * The coin faces. Same correction as `play`: this used to start at
   * `brand.amber`, which put a 38px white "You" on a 2:1 ground.
   */
  coin: 'linear-gradient(135deg,#A35F00,#D63C58)',
  premium: 'linear-gradient(135deg,#6E5AC8,#3F3161)',
  brandCta: 'linear-gradient(180deg,#F0546F,#D63C58)',
  xp: 'linear-gradient(90deg,#F5A524,#F0546F)',
} as const;

/**
 * Tab-bar colours. Spec: active rose, inactive #C4BAC9.
 *
 * The bar floats: it is a capsule inset from all three edges, with the screen's
 * own background running edge to edge behind and beneath it. That is why there
 * is no opaque fill token here — the surface is a blur, and what shows through
 * it is the screen, which is exactly the continuity that a bar bolted to the
 * bottom edge could never give.
 *
 * `scrim` is a translucent wash laid over the blur, not instead of it. A blur
 * alone tracks whatever passes behind it, so a white card sliding under the bar
 * takes the labels with it; the scrim holds a floor of contrast so `inactive`
 * stays legible over any content. Kept low enough that the blur still reads.
 *
 * `hairline` is the capsule's edge. On glass it is the only thing separating
 * the bar from a light background — without it the capsule dissolves at the
 * top of a scrolled screen — so it is a *border*, not a shadow, and it is per
 * scheme because a dark rim on a dark bar is invisible.
 */
export const tabColors = {
  active: '#F0546F',
  inactive: '#C4BAC9',
  /** Android press ripple — rose at low alpha, matching the active tint. */
  ripple: 'rgba(240,84,111,0.12)',
  light: {
    scrim: 'rgba(251,248,250,0.55)',
    hairline: 'rgba(34,26,43,0.08)',
  },
  dark: {
    scrim: 'rgba(33,26,40,0.55)',
    hairline: 'rgba(246,241,247,0.12)',
  },
} as const;

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

/**
 * Height of the rose wash at the top of every screen.
 *
 * Shared by `Screen` and `ScreenHeader` on purpose: the header paints the same
 * gradient over the same 320px so its background lines up pixel-for-pixel with
 * the screen scrolling underneath it. Change it in one place or the seam shows.
 */
export const washHeight = 320;

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

/**
 * Geometry of the floating tab bar.
 *
 * Declared *after* `gutter` on purpose — it reads it. A `const` referenced
 * above its own declaration is a temporal-dead-zone ReferenceError thrown while
 * this module evaluates, which in an expo-router app surfaces as a route module
 * coming back undefined, nowhere near the file that caused it.
 *
 * These are *design* values, not a guess at the platform's native bar — the
 * distinction that matters, because a `tabBarHeight` constant used to live here
 * for the opposite reason and was wrong on every device that disagreed with it.
 * The bar is ours now: we state its height and react-navigation reports that
 * same number back through `BottomTabBarHeightContext` (`getTabBarHeight`
 * returns an explicit `height` verbatim).
 *
 * `lift` sits *above* the bottom safe-area inset, so on a gesture-nav phone the
 * capsule clears the home indicator rather than sitting under it. Anything
 * padding for the bar owes `safeArea.bottom + lift + height + clearance`;
 * `useChromeInsets` is the one place that arithmetic is written down.
 */
export const floatingTabBar = {
  height: 64,
  /** Side margin. Matches the screen gutter so the capsule lines up with cards. */
  inset: gutter,
  /** Gap between the capsule and the top of the gesture area. */
  lift: 10,
  /** Breathing room between scrolled content and the capsule. */
  clearance: 12,
  /** Blur strength. Low enough that the scrim still does the contrast work. */
  intensity: 60,
} as const;

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
  /**
   * Under the gradient hero only. Plum rather than rose or iris because the
   * card is both of those at once and either one alone pulls the glow toward
   * that end; softer than `brand` because this sits under a full-width surface,
   * where a button's alpha reads as a bruise.
   */
  hero: '0 14px 30px rgba(116,52,120,0.22)',
} as const;

export const motion = {
  tap: { ms: 120 },
  screen: { ms: 260 },
  sheet: { ms: 320 },
  reward: { ms: 420, overshoot: 0.04 },
  coin: { ms: 1150 },
  wheel: { ms: 1400 },

  /**
   * Play-specific curves.
   *
   * `stagger` is the gap between two tiles entering, not a duration — six tiles
   * at 55ms each finish in 330ms, which is under the 400ms where a list stops
   * feeling like it is arriving and starts feeling like it is loading.
   *
   * `celebrate` is deliberately longer than `reward`: it plays once, after a
   * result the user was waiting on, and it is the only moment in the app that
   * gets to be theatrical.
   */
  stagger: { ms: 55 },
  celebrate: { ms: 620 },
  /** Idle breathing on the hero glyph. One slow cycle, never attention-seeking. */
  idle: { ms: 2600 },
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
  /** Standalone icons carrying a tap target on their own — the quick actions. */
  xl: 32,
  stroke: 2,
} as const;

export const layout = {
  ios: { minTarget: 44 },
  android: { minTarget: 48 },
  /** Built to the larger of the two everywhere, per the spec. */
  minTarget: 48,
  /** App header bar, *excluding* the status-bar inset it is padded down by. */
  headerBar: 56,
  /** Circular header affordance — back chevron, bell. Spec: 36px circle. */
  headerCircle: 36,
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
