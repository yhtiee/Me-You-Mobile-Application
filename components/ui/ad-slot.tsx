import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { usePremium } from '@/hooks/use-premium';
import { palette, radius, space } from '@/constants/tokens';

/**
 * Free-tier placeholder only — no AdMob SDK in the UI layer.
 *
 * Placement rules from the design system are enforced by where this is
 * mounted: never inside a duo card, never inside a sheet, never mid-tool.
 */
export function AdSlot({ label = 'AD · SPONSORED' }: { label?: string }) {
  const { showAds } = usePremium();
  if (!showAds) return null;

  return (
    <View
      accessibilityRole="none"
      style={{
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#E0D3DC',
        borderRadius: radius.md,
        borderCurve: 'continuous',
        paddingVertical: space.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
      }}
    >
      <Text role="overline" color={palette.light.textTertiary}>
        {label}
      </Text>
      <Text role="caption" color={palette.light.textTertiary}>
        Banner slot · 320×50
      </Text>
    </View>
  );
}
