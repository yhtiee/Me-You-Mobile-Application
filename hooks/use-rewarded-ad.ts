import { useCallback, useEffect, useRef, useState } from 'react';
// Type-only, so it is erased from the bundle and never requires the native
// module — the runtime import goes through `adsApi()`'s lazy guard.
import type { RewardedAd } from 'react-native-google-mobile-ads';

import { useAds } from '@/components/providers/ads-provider';
import { adUnitId, adsApi } from '@/lib/ads';

type RewardedHandle = {
  /** Loaded and ready to show. The only state in which an offer may be made. */
  available: boolean;
  /**
   * Show the ad. Resolves once it closes, with whether the reward was earned.
   * Resolves `false` straight away if nothing is loaded.
   */
  show: () => Promise<boolean>;
};

/**
 * One rewarded ad, preloaded while a screen is open.
 *
 * Preloaded rather than fetched on tap, because a rewarded ad that spins for
 * several seconds after "watch an ad" is pressed feels like the app has hung —
 * and a tap that then fails to produce anything is worse. `available` stays
 * false until the ad has genuinely loaded, so the caller only ever offers what
 * it can deliver.
 *
 * The reward is reported on *close*, not on the earned event. Earning fires
 * while the ad is still on screen; resolving there would let the caller navigate
 * away underneath a full-screen ad the user is still looking at.
 *
 * `enabled` lets the caller hold off loading until it knows the offer will be
 * made — no ad is requested for a premium couple, or for someone whose daily
 * rewarded questions are already used.
 */
export function useRewardedAd(enabled: boolean): RewardedHandle {
  const { supported, ready, showAds } = useAds();
  const [available, setAvailable] = useState(false);

  const adRef = useRef<RewardedAd | null>(null);
  const earnedRef = useRef(false);
  const settleRef = useRef<((earned: boolean) => void) | null>(null);

  const active = enabled && supported && ready && showAds;

  useEffect(() => {
    const ads = adsApi();
    const unitId = adUnitId('rewarded');
    if (!active || !ads || !unitId) return;

    const ad = ads.RewardedAd.createForAdRequest(unitId);
    adRef.current = ad;

    const unsubscribers = [
      ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => setAvailable(true)),

      ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
        earnedRef.current = true;
      }),

      ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
        setAvailable(false);
        settleRef.current?.(earnedRef.current);
        settleRef.current = null;
      }),

      ad.addAdEventListener(ads.AdEventType.ERROR, () => {
        // No retry loop: a failed request is not re-fired automatically, both to
        // avoid hammering the network and because repeated requests are the kind
        // of traffic AdMob treats as suspicious. The offer simply does not appear.
        setAvailable(false);
        settleRef.current?.(false);
        settleRef.current = null;
      }),
    ];

    ad.load();

    return () => {
      unsubscribers.forEach((off) => off());
      adRef.current = null;
      setAvailable(false);
    };
  }, [active]);

  const show = useCallback(async (): Promise<boolean> => {
    const ad = adRef.current;
    if (!ad || !ad.loaded) return false;

    earnedRef.current = false;

    return new Promise<boolean>((resolve) => {
      settleRef.current = resolve;
      void ad.show().catch(() => {
        settleRef.current = null;
        resolve(false);
      });
    });
  }, []);

  return { available, show };
}
