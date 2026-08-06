import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { layout, palette, radius, space } from '@/constants/tokens';

type Props = {
  label: string;
  checked: boolean;
  onToggle: () => void;
  /** Optional trailing affordance, e.g. "Message them ›". */
  action?: React.ReactNode;
};

export function CheckboxRow({ label, checked, onToggle, action }: Props) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => {
          if (process.env.EXPO_OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onToggle();
        }}
        hitSlop={8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          flex: 1,
          minHeight: layout.minTarget,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.sm - 1,
            borderCurve: 'continuous',
            borderWidth: checked ? 0 : 1.5,
            borderColor: theme.color.border,
            backgroundColor: checked ? palette.brand.rose : theme.color.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? (
            <Text role="caption" color="#fff">
              ✓
            </Text>
          ) : null}
        </View>
        <Text
          role="bodyStrong"
          style={{ flex: 1 }}
          color={checked ? theme.color.textTertiary : theme.color.textPrimary}
        >
          {label}
        </Text>
      </Pressable>
      {action}
    </View>
  );
}
