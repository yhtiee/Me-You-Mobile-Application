import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { palette, radius, space } from '@/constants/tokens';

type Props = {
  /** One-line invitation in rose, e.g. "+ Add a reminder". */
  label: string;
  onPress?: () => void;
};

/**
 * Dashed container + a single invitation. Deliberately not an
 * illustration-heavy blocker, per the design system.
 */
export function EmptyState({ label, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!onPress}
    >
      <View
        style={{
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: '#E0D3DC',
          borderRadius: radius.md,
          borderCurve: 'continuous',
          paddingVertical: space.xl,
          paddingHorizontal: space.lg,
          alignItems: 'center',
        }}
      >
        <Text role="bodyStrong" color={palette.brand.rose}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
