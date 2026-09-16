import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AdSlot } from '@/components/ui/ad-slot';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronIcon } from '@/components/ui/icons';
import { ListRow } from '@/components/ui/list-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { StreakBadge } from '@/components/ui/streak-badge';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useCouplePeople } from '@/hooks/use-couple-people';
import { usePremium } from '@/hooks/use-premium';
import { useProfile } from '@/hooks/use-profile';
import { useStreak } from '@/hooks/use-streak';
import { useTheme } from '@/components/providers/theme-provider';
import { gradients, icon, palette, radius, space } from '@/constants/tokens';

/** Profile, level progress, plan and settings entry point. */
export default function You() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const {
    count,
    level,
    levelTitle,
    nextMilestone,
    progress,
    levels,
    loading: progressLoading,
  } = useStreak();
  const { isPremium } = usePremium();
  const { partner } = useCouplePeople();

  return (
    <Screen gap={space.md}>
      <ProfileCard />

      {/* Level and streak come from `couples` now, so this card has a first
          load to sit through. Everything below it is still local. */}
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {progressLoading ? (
            <View style={{ gap: space.sm }}>
              <Skeleton width={56} height={10} />
              <Skeleton width={136} height={20} />
            </View>
          ) : (
            <View style={{ gap: space.xs }}>
              <Text role="overline" color={theme.color.textTertiary}>
                Level {level}
              </Text>
              <Text role="title2">{levelTitle}</Text>
            </View>
          )}
          {progressLoading ? (
            <Skeleton width={56} height={34} round={12} />
          ) : (
            <StreakBadge count={count} onPress={() => router.push('/streak')} />
          )}
        </View>

        <View style={{ gap: space.sm }}>
          {/* XP bar uses the amber→rose gradient, the only "gamey" moment. */}
          <ProgressBar value={progressLoading ? 0 : progress} gradient={gradients.xp} />
          {progressLoading ? (
            <Skeleton width="88%" height={12} />
          ) : (
            <Text role="caption" color={theme.color.textSecondary}>
              {nextMilestone
                ? `Next: Level ${nextMilestone.level} · ${nextMilestone.title} — ${nextMilestone.requirement}`
                : 'You’ve hit the top of the ladder. Genuinely.'}
            </Text>
          )}
        </View>
      </Card>

      {/* Plan card mirrors the mock: iris wash and different copy once premium. */}
      <Card
        style={{
          gap: space.md,
          backgroundColor: isPremium ? theme.tint.iris.bg : theme.color.surface,
        }}
      >
        <View style={{ gap: space.xs }}>
          <Text role="cardTitle" color={isPremium ? theme.tint.iris.fg : theme.color.textPrimary}>
            {isPremium ? 'Premium active' : 'Free plan'}
          </Text>
          <Text role="caption" color={isPremium ? theme.tint.iris.muted : theme.color.textSecondary}>
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
        <ListRow label="Paired with" value={partner?.name ?? 'Your partner'} />
        {/*
          * No "Couple code" row. It read the mock provider, so it showed a code
          * that matches no hub — and there is no real one to show instead. A code
          * is single-use: `redeem_couple_code` sets `invite_code` to null the
          * moment the partner joins, and this tab is only reachable once they
          * have. Displaying it would invite someone to share a code that cannot
          * work.
          */}
        <ListRow label="Themes" value={isPremium ? 'Unlocked' : 'Premium'} onPress={() => router.push('/paywall')} />
        <ListRow label="Settings" onPress={() => router.push('/settings')} />
        <ListRow label="Log out" destructive onPress={signOut} last />
      </Card>

      <AdSlot />
    </Screen>
  );
}

/**
 * The way in to your own details — photo, phone, handles.
 *
 * Sits at the top of You because it is the only thing on this screen that is
 * about *you* rather than about the two of you, and because the home prompt
 * sends people here expecting to land on something recognisable.
 *
 * It carries the same completeness fraction the prompt does, from the same
 * `measure`, so a user who half-finishes and comes back is told the same story
 * in both places.
 */
function ProfileCard() {
  const theme = useTheme();
  const { profile, completeness, loading } = useProfile();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Your profile"
      onPress={() => router.push('/profile')}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          {loading ? (
            <Skeleton width={56} height={56} round={28} />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.pill,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.color.surfaceSunken,
                borderWidth: 2,
                borderColor: palette.person.you,
              }}
            >
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Text role="title3" color={theme.color.textSecondary}>
                  {(profile?.displayName ?? 'Y').slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
          )}

          <View style={{ flex: 1, gap: space.xs }}>
            {loading ? (
              <>
                <Skeleton width={120} height={18} />
                <Skeleton width={160} height={10} />
              </>
            ) : (
              <>
                <Text role="title3">{profile?.displayName ?? 'Your profile'}</Text>
                <Text
                  role="caption"
                  color={completeness.isComplete ? theme.color.success : palette.brand.rose}
                >
                  {completeness.isComplete
                    ? 'Profile complete'
                    : `${completeness.done} of ${completeness.total} done — finish setting up`}
                </Text>
              </>
            )}
          </View>

          <ChevronIcon size={icon.sm} color={theme.color.textTertiary} />
        </View>
      </Card>
    </Pressable>
  );
}
