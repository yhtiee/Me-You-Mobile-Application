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
 * The iOS tracking prompt, behind the same lazy guard as the ads SDK.
 *
 * `expo-tracking-transparency` is a native module; a build without it must
 * degrade to "not asked" rather than take the ads path down with it.
 */
type TrackingModule = typeof import('expo-tracking-transparency');
let trackingCached: TrackingModule | null | undefined;

function trackingApi(): TrackingModule | null {
  if (trackingCached !== undefined) return trackingCached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    trackingCached = require('expo-tracking-transparency') as TrackingModule;
  } catch {
    trackingCached = null;
  }
  return trackingCached;
}

/**
 * Asks iOS for tracking permission, once, and only when consent allows it.
 *
 * Google's order: consent first, then ATT — and only if GDPR doesn't apply or
 * the person agreed to purpose 1 (store/access information on the device).
 * Asking someone who just refused that would be asking twice for the same thing.
 *
 * Declining is fine. The SDK then serves ads without the IDFA; nothing in the
 * app changes, which is what the permission string in `app.json` promises.
 * Android has no equivalent prompt and the module reports "granted" there.
 */
async function requestTrackingIfAllowed(ads: AdsModule): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const tracking = trackingApi();
  if (!tracking?.isAvailable()) return;

  try {
    const gdprApplies = await ads.AdsConsent.getGdprApplies();
    const purposeOne = gdprApplies ? (await ads.AdsConsent.getPurposeConsents()).startsWith('1') : true;
    if (!purposeOne) return;

    const current = await tracking.getTrackingPermissionsAsync();
    if (current.status === 'undetermined') await tracking.requestTrackingPermissionsAsync();
  } catch {
    // A failed prompt is a declined prompt: ads still serve, just without IDFA.
  }
}

/**
 * Consent (Google's UMP), gathered before the SDK starts.
 *
 * `gatherConsent` refreshes the person's consent status every launch and shows
 * the form only where a regulation requires it (UK, EEA, Switzerland, and the
 * US states AdMob covers). Everywhere else it resolves immediately.
 *
 * Returns whether ads may be requested.
 *
 * - Production follows `canRequestAds`, including when gathering fails: Google
 *   says to fall back to the status from the previous session, which is exactly
 *   what that flag reports.
 * - Test ads start regardless. The sample App IDs in `app.json` have no consent
 *   message behind them, so the form always errors there; refusing test ads on
 *   that basis would switch off the whole ads integration during development.
 */
async function gatherConsent(ads: AdsModule): Promise<boolean> {
  try {
    await ads.AdsConsent.gatherConsent();
  } catch (thrown) {
    if (!usingTestAds()) console.warn('Consent gathering failed; using the previous status.', thrown);
  }

  if (usingTestAds()) return true;

  try {
    const info = await ads.AdsConsent.getConsentInfo();
    return info.canRequestAds;
  } catch {
    return false;
  }
}

/**
 * Whether this person must be offered a way to change their consent.
 *
 * True only where a regulation requires it. The Settings row is shown on this,
 * so people elsewhere don't get a control that opens nothing.
 */
export async function privacyOptionsRequired(): Promise<boolean> {
  const ads = adsApi();
  if (!ads) return false;
  try {
    const info = await ads.AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

/** Reopens Google's consent form. Resolves once it is dismissed. */
export async function showPrivacyOptions(): Promise<void> {
  const ads = adsApi();
  if (!ads) return;
  await ads.AdsConsent.showPrivacyOptionsForm();
}

/*
 * Initialise the SDK once per app launch.
 *
 * Memoised as a promise rather than a boolean so concurrent callers — two
 * banners mounting in the same frame — share one `initialize()` instead of
 * racing to start the SDK twice.
 *
 * Resolves `false` when ads must not be requested: no SDK, consent withheld,
 * or start-up failed. Slots collapse in every one of those cases.
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

      if (!(await gatherConsent(ads))) return false;
      await requestTrackingIfAllowed(ads);

      await ads.default().initialize();
      return true;
    } catch (thrown) {
      console.warn('Ads failed to initialise:', thrown);
      return false;
    }
  })();

  return initialising;
}
