import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/components/providers/theme-provider';
import { gradients, palette, radius, space } from '@/constants/tokens';

const PERKS = [
  { glyph: '🚫', title: 'No more ads', body: 'The banners go, everywhere.' },
  { glyph: '💬', title: 'Unlimited coaching', body: 'Ask as often as you need to.' },
  { glyph: '🎨', title: 'Custom themes', body: 'Make it look like the two of you.' },
  { glyph: '📊', title: 'Deep analytics', body: 'See how your patterns actually move.' },
];

/** $1.00/month. StoreKit 2 / Play Billing land with the API layer. */
export default function Paywall() {
  const theme = useTheme();
  const { priceLabel, periodLabel, upgrade, isPremium } = usePremium();

  return (
    <Screen topPad={space.xxl} gap={space.xl}>
      <View
        style={{
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          padding: space.xxl,
          gap: space.sm,
          experimental_backgroundImage: gradients.premium,
        }}
      >
        <Text role="overline" color="rgba(255,255,255,0.75)">
          Me&u Premium
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <Text role="display" color="#fff">
            {priceLabel}
          </Text>
          <Text role="body" color="rgba(255,255,255,0.8)">
            {periodLabel}
          </Text>
        </View>
        <Text role="body" color="rgba(255,255,255,0.85)">
          Less than a coffee, once a month. Cancel whenever.
        </Text>
      </View>

      <View style={{ gap: space.lg }}>
        {PERKS.map((perk) => (
          <View key={perk.title} style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: palette.brand.irisSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20 }}>{perk.glyph}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text role="cardTitle">{perk.title}</Text>
              <Text role="caption" color={theme.color.textSecondary}>
                {perk.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: space.md }}>
        <Button
          label={isPremium ? 'You’re already premium' : `Upgrade for ${priceLabel}`}
          variant="premium"
          full
          disabled={isPremium}
          onPress={() => {
            upgrade();
            router.back();
          }}
        />
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text role="caption" center color={theme.color.textSecondary}>
            Not now
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => {}}>
          <Text role="caption" center color={theme.color.textTertiary}>
            Restore purchases
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
