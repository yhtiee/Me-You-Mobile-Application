import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { layout, palette, space } from '@/constants/tokens';

type Props = {
  label: string;
  value?: string;
  sublabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  left?: React.ReactNode;
  destructive?: boolean;
  last?: boolean;
};

/** Settings / wiki style row with a hairline divider. */
export function ListRow({
  label,
  value,
  sublabel,
  onPress,
  right,
  left,
  destructive,
  last,
}: Props) {
  const theme = useTheme();

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: layout.minTarget,
        paddingVertical: space.md - 2,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.color.border,
      }}
    >
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          role="bodyStrong"
          color={destructive ? theme.color.danger : theme.color.textPrimary}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text role="caption" color={theme.color.textSecondary}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text role="body" color={theme.color.textSecondary} selectable>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && !right ? (
        <Text role="body" color={palette.light.textTertiary}>
          ›
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(34,26,43,0.08)' }}
    >
      {body}
    </Pressable>
  );
}
