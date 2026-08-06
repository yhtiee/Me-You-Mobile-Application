import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { useStreak } from '@/hooks/use-streak';
import { useTheme } from '@/components/providers/theme-provider';
import { gradients, palette, space } from '@/constants/tokens';

/** Streak rules, current count and level progress (PRD Module 1). */
export default function StreakDialog() {
  const theme = useTheme();
  const { count, level, levelTitle, nextMilestone, progress, bothCheckedIn } = useStreak();

  return (
    <Dialog
      title={`${count} days running`}
      subtitle="The streak grows on days you both check in. Miss one and it resets — but nothing else is lost."
      actions={<Button label="Got it" full onPress={() => router.back()} />}
    >
      <View style={{ gap: space.md, marginTop: space.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Level {level}
          </Text>
          <Text role="cardTitle" color={palette.brand.rose}>
            {levelTitle}
          </Text>
        </View>
        <ProgressBar value={progress} gradient={gradients.xp} />
        {nextMilestone ? (
          <Text role="caption" color={theme.color.textSecondary}>
            Level {nextMilestone.level} · {nextMilestone.title} — {nextMilestone.requirement}
          </Text>
        ) : null}

        <View
          style={{
            padding: space.md,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: bothCheckedIn ? '#E6F1EA' : palette.brand.amberSoft,
          }}
        >
          <Text role="caption" color={bothCheckedIn ? theme.color.success : '#B97400'}>
            {bothCheckedIn
              ? 'Both of you are in for today. Nothing to do.'
              : 'One of you still hasn’t checked in today.'}
          </Text>
        </View>
      </View>
    </Dialog>
  );
}
