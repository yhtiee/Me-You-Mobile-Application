import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useCouple } from '@/components/providers/couple-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, radius, space } from '@/constants/tokens';
import type { CalendarEvent } from '@/types/domain';

const KINDS: { key: CalendarEvent['kind']; label: string }[] = [
  { key: 'anniversary', label: 'Anniversary' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'first-date', label: 'First date' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'date-night', label: 'Date night' },
  { key: 'custom', label: 'Something else' },
];

export default function AddEvent() {
  const theme = useTheme();
  const { addEvent } = useCouple();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<CalendarEvent['kind']>('date-night');

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const valid = title.trim().length > 0 && validDate;

  return (
    <Screen gap={space.xl}>
      <Card style={{ gap: space.lg }}>
        <TextField label="What is it" placeholder="Her birthday, our anniversary…" value={title} onChangeText={setTitle} />
        <TextField
          label="When"
          placeholder="2026-09-02"
          value={date}
          onChangeText={setDate}
          keyboardType="numbers-and-punctuation"
          hint={date.length > 0 && !validDate ? 'Use YYYY-MM-DD' : 'Format: YYYY-MM-DD'}
        />
      </Card>

      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Type
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {KINDS.map((k) => {
            const active = k.key === kind;
            return (
              <Pressable
                key={k.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setKind(k.key)}
                style={{
                  paddingHorizontal: space.lg - 2,
                  paddingVertical: space.sm + 1,
                  borderRadius: radius.pill,
                  backgroundColor: active ? palette.brand.roseSoft : theme.color.surface,
                  borderWidth: 1,
                  borderColor: active ? palette.brand.roseSoft : theme.color.border,
                }}
              >
                <Text
                  role="caption"
                  color={active ? palette.brand.rosePressed : theme.color.textSecondary}
                >
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button
        label="Add to calendar"
        full
        disabled={!valid}
        onPress={() => {
          addEvent({ title: title.trim(), date, kind });
          router.back();
        }}
      />
    </Screen>
  );
}
