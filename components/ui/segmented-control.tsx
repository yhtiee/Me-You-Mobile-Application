import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { layout, palette, radius, shadow, space } from '@/constants/tokens';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Track surface.sunken, pill radius, 4px inset. Active thumb is white +
 * shadow.1 + rose label.
 *
 * The spec wrote this for 3 items (Today / Us / Play), which no longer exist.
 * It is not limited to three — every item is `flex: 1`, so the track divides
 * evenly however many it is given — and the check-in sheet uses it for the six
 * battery stops, where the point is that a level is *one control with a
 * position in it* rather than six buttons. Six is comfortable at 375pt; past
 * that, labels start truncating and the answer is fewer stops, not a smaller
 * font.
 */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: theme.color.surfaceSunken,
        borderRadius: radius.pill,
        padding: space.xs,
        gap: 2,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: layout.minTarget - 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: active ? theme.color.surface : 'transparent',
              boxShadow: active ? shadow.s1 : undefined,
            }}
          >
            <Text
              role="bodyStrong"
              color={active ? palette.brand.rose : theme.color.textSecondary}
              style={{ fontFamily: 'Manrope_700Bold' }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
