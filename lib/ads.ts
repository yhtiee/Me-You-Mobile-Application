import { Platform } from 'react-native';

/**
 * AdMob, behind the same guard as `expo-notifications`.
 *
 * `react-native-google-mobile-ads` is a native module that does not exist in
 * Expo Go. Imported statically, that failure hoists into every file that
 * touches ads, and in an expo-router app it surfaces as a whole route tree
 * failing to load with an error naming nothing to do with ads — the exact
 * cascade documented at the top of `lib/notifications.ts`. So the SDK is
 * required lazily, once, and every caller treats `null` as "no ads on this
 * runtime" and renders the placeholder instead.
 *
 * ## Which App ID is in the native config
 *
 * `app.json` carries Google's published *sample* App IDs, not this project's:
 *
 *   Android  ca-app-pub-3940256099942544~3347511713
 *   iOS      ca-app-pub-3940256099942544~1458002511
 *
 * Google's quick starts say "while testing, use the sample app ID". Swapping in
 * the real IDs is native config, so it needs a rebuild, and it happens once as
 * part of going to production — not before.
 */

type AdsModule = typeof import('react-native-google-mobile-ads');

/** `undefined` = not yet attempted, `null` = attempted and unavailable. */
let cached: AdsModule | null | undefined;

export function adsApi(): AdsModule | null {
  // Metro caches a module that threw and re-throws on every later `require`,
  // so this must run at most once — hence caching the failure too.
  if (cached !== undefined) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    cached = null;
  }

  return cached;
}

/** Whether this runtime can show ads at all. False in Expo Go. */
export function adsSupported(): boolean {
  return adsApi() !== null;
}

export type AdFormat = 'banner' | 'rewarded';

/*
 * Real ad unit IDs, per platform, from EAS environment variables.
 *
 * Referenced one by one, statically, on purpose. Metro only inlines
 * `process.env.EXPO_PUBLIC_*` when it can see the full name at build time; a
 * lookup like `process.env[name]` is left as a runtime read of an object that
 * does not exist in the bundle, and silently returns undefined.
 *
 * These are set only in the **production** EAS environment. Development and
 * preview builds therefore get `undefined` here and fall through to Google's
 * test units — so no build a developer or tester installs can ever serve a
 * live ad, which is how AdMob accounts get suspended for invalid clicks.
 */
const REAL_UNITS: Record<AdFormat, string | undefined> = {
  banner: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID,
  }),
  rewarded: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID,
  }),
};

/**
 * The ad unit to request for a format.
 *
 * Test units unless a real one was supplied *and* this is not a development
 * bundle. `__DEV__` is the second lock: even if someone copies production
 * variables into a local `.env`, a Metro-served dev build still asks for test
 * ads.
 */
export function adUnitId(format: AdFormat): string | null {
  const ads = adsApi();
  if (!ads) return null;

  const real = REAL_UNITS[format];
  if (real && !__DEV__) return real;

  return format === 'banner' ? ads.TestIds.ADAPTIVE_BANNER : ads.TestIds.REWARDED;
}

/** True while every request goes to Google's test inventory. */
export function usingTestAds(): boolean {
  return __DEV__ || !REAL_UNITS.banner;
}

/*
 * Initialise the SDK once per app launch.
 *
 * Memoised as a promise rather than a boolean so concurrent callers — two
 * banners mounting in the same frame — share one `initialize()` instead of
 * racing to start the SDK twice.
 */
let initialising: Promise<boolean> | null = null;

export function initializeAds(): Promise<boolean> {
  if (initialising) return initialising;

  initialising = (async () => {
    const ads = adsApi();
    if (!ads) return false;

    try {
      /*
       * Brand safety, set before the first request. Me&u is an app two people
       * share about their relationship; an adult or mature-rated ad appearing
       * under their check-in is the kind of thing that gets an app deleted.
       * `T` excludes mature content while leaving enough inventory to fill.
       */
      await ads.default().setRequestConfiguration({
        maxAdContentRating: ads.MaxAdContentRating.T,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });

      // Consent (UMP) and the iOS tracking prompt slot in here, before
      // `initialize()`, when production ads are switched on. Test ads serve
      // without either.
      await ads.default().initialize();
      return true;
    } catch (thrown) {
      console.warn('Ads failed to initialise:', thrown);
      return false;
    }
  })();

  return initialising;
}
