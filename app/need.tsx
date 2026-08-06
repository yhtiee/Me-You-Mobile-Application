import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useCheckin } from '@/hooks/use-checkin';
import { useTheme } from '@/components/providers/theme-provider';
import { NEED_LABELS, type NeedKey } from '@/types/domain';
import { layout, palette, radius, space } from '@/constants/tokens';

const OPTIONS: { key: NeedKey; glyph: string }[] = [
  { key: 'quality-time', glyph: '⏳' },
  { key: 'words', glyph: '💬' },
  { key: 'space', glyph: '🌿' },
  { key: 'touch', glyph: '🤝' },
  { key: 'acts', glyph: '🧺' },
];

/** Follow-up after a Sad or Stressed check-in (PRD Module 1). */
export default function Need() {
  const theme = useTheme();
  const { you, setNeed, partner } = useCheckin();

  return (
    <SheetBody
      title="What do you need right now?"
      subtitle={`We’ll tell ${partner.name} gently — no pressure attached.`}
    >
      <View style={{ gap: space.sm }}>
        {OPTIONS.map((option) => {
          const active = you.need === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setNeed(option.key);
                router.back();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                minHeight: layout.minTarget + 6,
                paddingHorizontal: space.lg,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                borderWidth: 1.5,
                borderColor: active ? palette.brand.rose : theme.color.border,
                backgroundColor: active ? palette.brand.roseSoft : theme.color.surface,
              }}
            >
              <Text style={{ fontSize: 20 }}>{option.glyph}</Text>
              <Text role="bodyStrong" style={{ flex: 1 }}>
                {NEED_LABELS[option.key].replace('Needs ', '')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ marginTop: 'auto' }}>
        <Text role="caption" center color={theme.color.textSecondary}>
          I’d rather not say
        </Text>
      </Pressable>
    </SheetBody>
  );
}
