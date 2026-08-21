import { Pressable, View } from 'react-native';

import { Glyph } from '@/components/ui/glyph';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { radius, space } from '@/constants/tokens';

type Props = {
  count: number;
  onPress?: () => void;
};

/**
 * 34px rounded-square, amber fill, amber numerals, 800 weight.
 *
 * The numerals used to be `#B97400`, which is 3.4:1 on `amberSoft` — under the
 * 4.5:1 this size of text needs. `tint.amber.fg` is the same hue two steps
 * darker and passes at 6:1, and it inverts on its own in dark mode.
 */
export function StreakBadge({ count, onPress }: Props) {
  const theme = useTheme();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm - 2,
        backgroundColor: theme.tint.amber.bg,
        borderRadius: radius.md - 2,
        borderCurve: 'continuous',
        paddingHorizontal: space.md - 2,
        height: 34,
      }}
    >
      {/* Fixed 34px pill, so this must not scale with the OS text size — at the
          largest settings a scaling flame is taller than the badge holding it. */}
      <Glyph size={12}>🔥</Glyph>
      <Text
        role="cardTitle"
        color={theme.tint.amber.fg}
        tabular
        style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
      >
        {count}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} day streak. Opens streak rules.`}
      onPress={onPress}
      hitSlop={8}
    >
      {content}
    </Pressable>
  );
}
