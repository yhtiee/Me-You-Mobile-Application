import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { usePremium } from '@/hooks/use-premium';
import { adsSupported, initializeAds } from '@/lib/ads';

export type AdsState = {
  /** This runtime can load the SDK at all. False in Expo Go. */
  supported: boolean;
  /** The SDK finished initialising and requests may be made. */
  ready: boolean;
  /** Entitlement has been read. Until then, slots hold space but request nothing. */
  resolved: boolean;
  /** Free tier, resolved. The one flag a slot needs before requesting an ad. */
  showAds: boolean;
};

const AdsContext = createContext<AdsState>({
  supported: false,
  ready: false,
  resolved: false,
  showAds: false,
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
  const supported = adsSupported();

  const shouldInit = supported && resolved && showAds;

  useEffect(() => {
    if (!shouldInit) return;

    let active = true;
    void initializeAds().then((ok) => {
      if (active) setReady(ok);
    });

    return () => {
      active = false;
    };
  }, [shouldInit]);

  return (
    <AdsContext
      value={{
        supported,
        ready,
        resolved,
        showAds: resolved && showAds,
      }}
    >
      {children}
    </AdsContext>
  );
}

export function useAds(): AdsState {
  return use(AdsContext);
}
