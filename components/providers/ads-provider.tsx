import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { usePremium } from '@/hooks/use-premium';
import { adsSupported, initializeAds, privacyOptionsRequired, showPrivacyOptions } from '@/lib/ads';

export type AdsState = {
  /** This runtime can load the SDK at all. False in Expo Go. */
  supported: boolean;
  /** The SDK finished initialising and requests may be made. */
  ready: boolean;
  /** Entitlement has been read. Until then, slots hold space but request nothing. */
  resolved: boolean;
  /** Free tier, resolved. The one flag a slot needs before requesting an ad. */
  showAds: boolean;
  /**
   * Start-up finished and ads must not be requested — consent withheld, or the
   * SDK failed. Slots collapse instead of holding space for an ad that won't come.
   */
  blocked: boolean;
  /** A regulation requires a way to change consent, so Settings shows one. */
  privacyOptionsRequired: boolean;
  /** Reopens the consent form, then re-checks what it may show. */
  openPrivacyOptions: () => Promise<void>;
};

const AdsContext = createContext<AdsState>({
  supported: false,
  ready: false,
  resolved: false,
  showAds: false,
  blocked: false,
  privacyOptionsRequired: false,
  openPrivacyOptions: async () => {},
});

/**
 * Entitlement and SDK start-up, resolved once for the whole app.
 *
 * Every banner used to decide for itself whether to show, which meant one
 * premium query per mounted slot — and tab stacks keep their screens mounted,
 * so Home, Calendar, You and Play would each have held their own. One read here
 * serves all of them, and every slot agrees.
 *
 * The SDK is only initialised for free couples. A paying couple never loads the
 * ad SDK at all: no measurement, no network requests, nothing running in the
 * background of an app they pay to keep quiet.
 */
export function AdsProvider({ children }: { children: ReactNode }) {
  const { showAds, resolved } = usePremium();
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [optionsRequired, setOptionsRequired] = useState(false);
  const supported = adsSupported();

  const shouldInit = supported && resolved && showAds;

  useEffect(() => {
    if (!shouldInit) return;

    let active = true;
    void initializeAds().then(async (ok) => {
      if (!active) return;
      setReady(ok);
      setBlocked(!ok);
      // Read after start-up: the consent status is only current once gathered.
      const required = await privacyOptionsRequired();
      if (active) setOptionsRequired(required);
    });

    return () => {
      active = false;
    };
  }, [shouldInit]);

  const openPrivacyOptions = useCallback(async () => {
    try {
      await showPrivacyOptions();
    } catch (thrown) {
      console.warn('Could not open privacy options:', thrown);
    }
    /*
     * A changed choice applies to the next ad request; the SDK reads it itself.
     * Nothing to re-initialise. Whether the row stays is re-read in case the
     * requirement changed.
     */
    setOptionsRequired(await privacyOptionsRequired());
  }, []);

  return (
    <AdsContext
      value={{
        supported,
        ready,
        resolved,
        showAds: resolved && showAds,
        blocked,
        // Premium couples never start the SDK, and have no ad consent to manage.
        privacyOptionsRequired: optionsRequired && showAds,
        openPrivacyOptions,
      }}
    >
      {children}
    </AdsContext>
  );
}

export function useAds(): AdsState {
  return use(AdsContext);
}
