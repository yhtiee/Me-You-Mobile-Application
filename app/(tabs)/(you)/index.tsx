import { router } from 'expo-router';
import { View } from 'react-native';

import { AdSlot } from '@/components/ui/ad-slot';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { StreakBadge } from '@/components/ui/streak-badge';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useCouple } from '@/components/providers/couple-provider';
import { usePremium } from '@/hooks/use-premium';
import { useStreak } from '@/hooks/use-streak';
import { useTheme } from '@/components/providers/theme-provider';
import { gradients, palette, space } from '@/constants/tokens';

/** Profile, level progress, plan and settings entry point. */
export default function You() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const { count, level, levelTitle, nextMilestone, progress, levels } = useStreak();
  const { isPremium } = usePremium();
  const { partner, coupleCode } = useCouple();

  return (
    <Screen gap={space.md}>
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: space.xs }}>
            <Text role="overline" color={theme.color.textTertiary}>
              Level {level}
            </Text>
            <Text role="title2">{levelTitle}</Text>
          </View>
          <StreakBadge count={count} onPress={() => router.push('/streak')} />
        </View>

        <View style={{ gap: space.sm }}>
          {/* XP bar uses the amber→rose gradient, the only "gamey" moment. */}
          <ProgressBar value={progress} gradient={gradients.xp} />
          <Text role="caption" color={theme.color.textSecondary}>
            {nextMilestone
              ? `Next: Level ${nextMilestone.level} · ${nextMilestone.title} — ${nextMilestone.requirement}`
              : 'You’ve hit the top of the ladder. Genuinely.'}
          </Text>
        </View>
      </Card>

      {/* Plan card mirrors the mock: iris wash and different copy once premium. */}
      <Card
        style={{
          gap: space.md,
          backgroundColor: isPremium ? palette.brand.irisSoft : theme.color.surface,
        }}
      >
        <View style={{ gap: space.xs }}>
          <Text role="cardTitle" color={isPremium ? '#3F3161' : theme.color.textPrimary}>
            {isPremium ? 'Premium active' : 'Free plan'}
          </Text>
          <Text role="caption" color={isPremium ? '#6B5C8E' : theme.color.textSecondary}>
            {isPremium ? 'No ads · unlimited coaching' : 'Ads on · 3 coach questions a day'}
          </Text>
        </View>
        <Button
          label={isPremium ? 'Manage' : 'Upgrade · $1'}
          variant={isPremium ? 'secondary' : 'premium'}
          full
          onPress={() => router.push(isPremium ? '/settings' : '/paywall')}
        />
      </Card>

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          The ladder
        </Text>
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          {levels.map((l, i) => {
            const reached = level >= l.level;
            return (
              <ListRow
                key={l.level}
                label={`Level ${l.level} · ${l.title}`}
                sublabel={l.requirement}
                last={i === levels.length - 1}
                right={
                  <Text role="overline" color={reached ? theme.color.success : theme.color.textTertiary}>
                    {reached ? 'Reached' : 'Locked'}
                  </Text>
                }
              />
            );
          })}
        </Card>
      </View>

      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        <ListRow label="Paired with" value={partner.name} />
        <ListRow label="Couple code" value={coupleCode} />
        <ListRow label="Themes" value={isPremium ? 'Unlocked' : 'Premium'} onPress={() => router.push('/paywall')} />
        <ListRow label="Settings" onPress={() => router.push('/settings')} />
        <ListRow label="Log out" destructive onPress={signOut} last />
      </Card>

      <AdSlot />
    </Screen>
  );
}
