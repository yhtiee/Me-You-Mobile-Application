import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useStreak } from '@/hooks/use-streak';
import { useTheme } from '@/components/providers/theme-provider';
import { gradients, palette, space } from '@/constants/tokens';

/** Streak rules, current count and level progress (PRD Module 1). */
export default function StreakDialog() {
  const theme = useTheme();
  const { count, level, levelTitle, nextMilestone, progress, bothCheckedIn, loading } = useStreak();

  return (
    <Dialog
      // A dialog whose headline is a number cannot open on a placeholder number:
      // "0 days running" for half a second reads as bad news, not as loading.
      title={loading ? 'Your streak' : `${count} days running`}
      subtitle="The streak grows on days you both check in. Miss one and it resets — but nothing else is lost."
      actions={<Button label="Got it" full onPress={() => router.back()} />}
    >
      <View style={{ gap: space.md, marginTop: space.xs }}>
        {loading ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={64} height={10} />
              <Skeleton width={88} height={12} />
            </View>
            <Skeleton height={8} round={4} />
            <Skeleton width="90%" height={12} />
            <Skeleton height={44} round={14} />
          </>
        ) : (
          <>
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
            backgroundColor: bothCheckedIn ? theme.tint.success.bg : theme.tint.amber.bg,
          }}
        >
          <Text role="caption" color={bothCheckedIn ? theme.color.success : theme.tint.amber.muted}>
            {bothCheckedIn
              ? 'Both of you are in for today. Nothing to do.'
              : 'One of you still hasn’t checked in today.'}
          </Text>
        </View>
          </>
        )}
      </View>
    </Dialog>
  );
}
