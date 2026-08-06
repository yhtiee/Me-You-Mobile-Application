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
import { palette, space } from '@/constants/tokens';

const PRESETS = [
  { label: 'Go on 4 dates this month', target: 4, unit: 'dates' },
  { label: 'Save ₦50,000 / $100 together', target: 50000, unit: '₦' },
  { label: 'Watch 3 movies together', target: 3, unit: 'movies' },
  { label: 'Pray / read a book together daily', target: 7, unit: 'days' },
];

export default function AddGoal() {
  const theme = useTheme();
  const { addGoal } = useCouple();
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');

  const valid = label.trim().length > 0 && Number(target) > 0;

  return (
    <Screen gap={space.xl}>
      <Text role="body" color={theme.color.textSecondary}>
        Something you’re doing together, with a number attached so you can see it move.
      </Text>

      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Start from one of these
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {PRESETS.map((preset) => (
            <Pressable
              key={preset.label}
              accessibilityRole="button"
              onPress={() => {
                setLabel(preset.label);
                setTarget(String(preset.target));
                setUnit(preset.unit);
              }}
              style={{
                paddingHorizontal: space.lg - 2,
                paddingVertical: space.sm + 1,
                borderRadius: 999,
                backgroundColor: palette.brand.roseSoft,
              }}
            >
              <Text role="caption" color={palette.brand.rosePressed}>
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Card style={{ gap: space.lg }}>
        <TextField label="Goal" placeholder="What are you going for?" value={label} onChangeText={setLabel} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 2 }}>
            <TextField
              label="Target"
              placeholder="4"
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 3 }}>
            <TextField label="Unit" placeholder="dates" value={unit} onChangeText={setUnit} />
          </View>
        </View>
      </Card>

      <Button
        label="Add goal"
        full
        disabled={!valid}
        onPress={() => {
          addGoal({
            label: label.trim(),
            current: 0,
            target: Number(target),
            unit: unit.trim() || 'done',
            done: false,
          });
          router.back();
        }}
      />
    </Screen>
  );
}
