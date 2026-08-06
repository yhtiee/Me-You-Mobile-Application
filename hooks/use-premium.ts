import { useCouple } from '@/components/providers/couple-provider';

/**
 * Entitlement state. Purely local for now — StoreKit 2 / Play Billing land with
 * the API layer, at which point `upgrade` becomes a real purchase flow.
 */
export function usePremium() {
  const { isPremium, upgrade } = useCouple();

  return {
    isPremium,
    /** Free tier shows ad slots; premium never does. */
    showAds: !isPremium,
    priceLabel: '$1.00',
    periodLabel: 'per month',
    upgrade,
  };
}
