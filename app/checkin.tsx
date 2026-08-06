import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { MoodPicker } from '@/components/duo/mood-picker';
import { SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useCheckin } from '@/hooks/use-checkin';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, radius, space } from '@/constants/tokens';

/** Daily mood & battery meter (PRD Module 1). */
export default function Checkin() {
  const theme = useTheme();
  const { you, setMood, setBattery, save, needsFollowUp } = useCheckin();

  return (
    <SheetBody title="How are you, honestly?" subtitle="Only the two of you ever see this.">
      <MoodPicker value={you.mood} onChange={setMood} />

      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Battery
          </Text>
          <Text role="title3" tabular color={you.moodColor}>
            {you.battery}%
          </Text>
        </View>

        {/* Stepper rather than a slider: no extra dependency, and it stays
            usable with assistive tech and larger font scales. */}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {[10, 25, 50, 75, 90, 100].map((value) => {
            const active = you.battery === value;
            return (
              <Button
                key={value}
                label={`${value}`}
                variant={active ? 'primary' : 'neutral'}
                style={{ flex: 1, paddingHorizontal: 0 }}
                onPress={() => setBattery(value)}
              />
            );
          })}
        </View>

        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.color.surfaceSunken,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${you.battery}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: you.moodColor,
            }}
          />
        </View>
      </View>

      <View style={{ marginTop: 'auto', gap: space.sm }}>
        {needsFollowUp ? (
          <View
            style={{
              padding: space.md,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: palette.brand.roseSoft,
            }}
          >
            <Text role="caption" color={palette.brand.rosePressed}>
              We’ll ask what you need next — no pressure to answer.
            </Text>
          </View>
        ) : null}
        <Button
          label="Save today’s check-in"
          full
          onPress={() => {
            save();
            // Sad or Stressed rolls straight into the "what do you need?" sheet.
            if (needsFollowUp) router.replace('/need');
            else router.back();
          }}
        />
      </View>
    </SheetBody>
  );
}
