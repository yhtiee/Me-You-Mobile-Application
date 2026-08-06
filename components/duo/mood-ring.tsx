import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';

type Props = {
  /** Mood colour drives the ring; battery % sits in the middle. */
  color: string;
  battery: number;
  size?: number;
};

/** 58px ring, 5px border in the mood colour, battery % centred. */
export function MoodRing({ color, battery, size = 58 }: Props) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${battery} percent`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 5,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.surface,
      }}
    >
      <Text role="cardTitle" tabular color={theme.color.textPrimary}>
        {battery}
        <Text role="overline" color={theme.color.textTertiary}>
          %
        </Text>
      </Text>
    </View>
  );
}
