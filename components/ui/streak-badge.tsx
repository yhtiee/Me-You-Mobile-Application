import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { palette, radius, space } from '@/constants/tokens';

type Props = {
  count: number;
  onPress?: () => void;
};

/** 34px rounded-square, amberSoft fill, #B97400 numerals, 800 weight. */
export function StreakBadge({ count, onPress }: Props) {
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm - 2,
        backgroundColor: palette.brand.amberSoft,
        borderRadius: radius.md - 2,
        borderCurve: 'continuous',
        paddingHorizontal: space.md - 2,
        height: 34,
      }}
    >
      <Text role="caption" color="#B97400">
        🔥
      </Text>
      <Text
        role="cardTitle"
        color="#B97400"
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
