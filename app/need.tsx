import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { saveMyNeed } from '@/lib/home';
import { NEED_LABELS, type NeedKey } from '@/types/domain';
import { layout, palette, radius, space } from '@/constants/tokens';

const OPTIONS: { key: NeedKey; glyph: string }[] = [
  { key: 'quality-time', glyph: '⏳' },
  { key: 'words', glyph: '💬' },
  { key: 'space', glyph: '🌿' },
  { key: 'touch', glyph: '🤝' },
  { key: 'acts', glyph: '🧺' },
];

/**
 * Follow-up after a Sad or Stressed check-in (PRD Module 1).
 *
 * Amends the row `checkin` just wrote — this sheet is only ever reached by a
 * `replace` from it, so the check-in it updates always exists. The partner's
 * name is deliberately not fetched: this sheet is one column write away from a
 * closed sheet, and a round trip to personalise a subtitle is not worth the
 * frame it would cost.
 */
export default function Need() {
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const [pending, setPending] = useState<NeedKey | 'none' | null>(null);

  const choose = async (need: NeedKey | null) => {
    if (!user) {
      toast.error('Your session ended. Log in again to continue.');
      return;
    }

    setPending(need ?? 'none');
    try {
      await saveMyNeed(user.id, need);
      router.back();
    } catch (thrown) {
      setPending(null);
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save what you need.');
    }
  };

  return (
    <SheetBody
      title="What do you need right now?"
      subtitle="They’ll see it gently — no pressure attached."
    >
      <View style={{ gap: space.sm }}>
        {OPTIONS.map((option) => {
          const active = pending === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: pending !== null }}
              disabled={pending !== null}
              onPress={() => void choose(option.key)}
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
                // Dims the rest of the list while one option is committing, so a
                // slow write reads as "working" rather than "did that register?".
                opacity: pending !== null && !active ? 0.5 : 1,
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

      {/* Clears the column rather than just closing: "I'd rather not say" has to
          mean no ask is published, including one set earlier today. */}
      <Pressable
        accessibilityRole="button"
        disabled={pending !== null}
        onPress={() => void choose(null)}
        style={{ marginTop: 'auto', paddingVertical: space.sm }}
      >
        <Text role="caption" center color={theme.color.textSecondary}>
          I’d rather not say
        </Text>
      </Pressable>
    </SheetBody>
  );
}
