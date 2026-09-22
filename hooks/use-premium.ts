import { useCallback } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useCouple } from '@/components/providers/couple-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { fetchIsPremium } from '@/lib/entitlement';

/**
 * `profiles` carries `is_premium` and `premium_until`, so a purchase or a lapse
 * written by the billing webhook reaches this device without a restart.
 */
const PREMIUM_TABLES = ['profiles'] as const;

/**
 * Entitlement state.
 *
 * `isPremium` is read from the database. It used to come from the mock
 * `CoupleProvider`, where it is a local `useState(false)` — harmless while ad
 * slots were dashed placeholders, and a real bug once they serve ads: every
 * slot outside Home would have shown live ads to couples who pay to remove
 * them.
 *
 * `upgrade` is still the mock, because there is no billing yet (StoreKit 2 and
 * Play Billing are not integrated). Deliberately, calling it no longer changes
 * `isPremium`: a pretend purchase must not hide real ads. When billing lands,
 * the purchase writes `profiles.is_premium` server-side and this hook picks it
 * up through the realtime subscription with no change here.
 */
export function usePremium() {
  const { user } = useAuth();
  const { upgrade } = useCouple();

  const load = useCallback(async () => fetchIsPremium(), []);

  const { data, loading } = useAsyncData(user ? load : null, PREMIUM_TABLES);

  /*
   * Unknown is not the same as premium. While the first read is in flight
   * `data` is null, and treating that as "premium" would flash the screen
   * adless and then pop banners in. Ad slots hold their space as a placeholder
   * during that window instead — see `AdSlot`.
   */
  const isPremium = data === true;

  return {
    isPremium,
    /** True once the entitlement has been read at least once. */
    resolved: data !== null,
    loading,
    /** Free tier shows ads; premium never does. */
    showAds: !isPremium,
    priceLabel: '$1.00',
    periodLabel: 'per month',
    upgrade,
  };
}
