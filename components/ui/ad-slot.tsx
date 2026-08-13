import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/components/providers/theme-provider';
import { radius, space } from '@/constants/tokens';

/**
 * Free-tier placeholder only — no AdMob SDK in the UI layer.
 *
 * Placement rules from the design system are enforced by where this is
 * mounted: never inside a duo card, never inside a sheet, never mid-tool.
 */
export function AdSlot({
  label = 'AD · SPONSORED',
  show,
}: {
  label?: string;
  /**
   * Overrides the entitlement hook. Passed by screens that have already read
   * `couples.is_premium` from the API — `usePremium` still reads the mock store
   * for the screens that have not been migrated, and a real premium couple must
   * not be shown an ad slot because of it.
   */
  show?: boolean;
}) {
  const { showAds } = usePremium();
  const theme = useTheme();

  if (!(show ?? showAds)) return null;

  return (
    <View
      accessibilityRole="none"
      style={{
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.color.border,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        paddingVertical: space.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
      }}
    >
      <Text role="overline" color={theme.color.textTertiary}>
        {label}
      </Text>
      <Text role="caption" color={theme.color.textTertiary}>
        Banner slot · 320×50
      </Text>
    </View>
  );
}
