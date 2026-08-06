import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { layout, palette, radius, space } from '@/constants/tokens';
import { MOOD_LABELS, type MoodKey } from '@/types/domain';

const MOODS: { key: MoodKey; glyph: string }[] = [
  { key: 'happy', glyph: '😊' },
  { key: 'neutral', glyph: '😐' },
  { key: 'sad', glyph: '😔' },
  { key: 'stressed', glyph: '😣' },
];

type Props = {
  value: MoodKey;
  onChange: (mood: MoodKey) => void;
};

/** Four tiles built to the 48px Android minimum, per the spec. */
export function MoodPicker({ value, onChange }: Props) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', gap: space.sm }}
    >
      {MOODS.map((mood) => {
        const active = mood.key === value;
        return (
          <Pressable
            key={mood.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={MOOD_LABELS[mood.key]}
            onPress={() => onChange(mood.key)}
            style={{
              flex: 1,
              minHeight: layout.minTarget + 20,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              paddingVertical: space.md,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              borderWidth: 2,
              borderColor: active ? palette.mood[mood.key] : theme.color.border,
              backgroundColor: theme.color.surface,
            }}
          >
            <Text role="title3">{mood.glyph}</Text>
            <Text
              role="overline"
              color={active ? palette.mood[mood.key] : theme.color.textTertiary}
            >
              {MOOD_LABELS[mood.key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
