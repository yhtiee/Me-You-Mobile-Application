import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { DuoStateCard, DuoStateCardSkeleton } from '@/components/duo/duo-state-card';
import { CoupleBanner, CoupleBannerSkeleton } from '@/components/home/couple-banner';
import { ProfilePrompt } from '@/components/home/profile-prompt';
import { QuickActions } from '@/components/home/quick-actions';
import { StreakSection, StreakSectionSkeleton } from '@/components/home/streak-section';
import { useTheme } from '@/components/providers/theme-provider';
import { AdSlot } from '@/components/ui/ad-slot';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckboxRow } from '@/components/ui/checkbox-row';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { layout, radius, space } from '@/constants/tokens';
import { useHome, type HomeView } from '@/hooks/use-home';

/**
 * The daily hub, and now the whole of Home: banner, quick actions, streak, both
 * moods, the nudge.
 *
 * Reads Supabase through `useHome`. Three states are real and all three are
 * drawn: first load (skeletons), failed load (retry), and loaded — where each
 * section still has to cope with data that legitimately is not there yet,
 * because a person who has not checked in today has no mood and a hub with one
 * member has no partner.
 */
export function TodaySegment() {
  const { view, error, loading, refetch, toggleCheckedOnThem } = useHome();

  if (loading) return <TodaySkeleton />;

  if (!view) {
    return (
      <ErrorState
        message={error ?? 'We couldn’t load your hub just now.'}
        onRetry={refetch}
      />
    );
  }

  return <TodayContent view={view} onToggleCheckedOnThem={toggleCheckedOnThem} />;
}

function TodayContent({
  view,
  onToggleCheckedOnThem,
}: {
  view: HomeView;
  onToggleCheckedOnThem: () => void;
}) {
  const theme = useTheme();
  const partnerName = view.partner?.name ?? 'your partner';

  return (
    <>
      <CoupleBanner
        you={{ name: view.you.name, avatarUrl: view.you.avatarUrl }}
        partner={view.partner ? { name: view.partner.name, avatarUrl: view.partner.avatarUrl } : null}
        togetherLabel={view.togetherLabel}
        streak={view.streak}
        onPressStreak={() => router.push('/streak')}
        onPressTogether={() => router.push('/settings')}
      />

      <StreakSection
        count={view.streak}
        level={view.level}
        bothCheckedIn={view.bothCheckedIn}
        onPress={() => router.push('/streak')}
      />

      {/* Above the day's check-in: high enough to be seen on open, low enough
          that it never displaces the thing the screen exists for. Renders
          nothing once the profile is complete. */}
      <ProfilePrompt />

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          How you’re both doing
        </Text>
        <DuoStateCard
          you={{ ...view.you, name: 'You' }}
          partner={view.partner}
          onPressYou={() => router.push('/checkin')}
        />
      </View>
      
      {/*
       * Below the check-in, not above it.
       *
       * These four are somewhere to go *next*; the check-in is the thing this
       * screen exists for. Sitting directly under the banner they were the
       * first interactive row on the page and pushed the day's actual ask below
       * the fold on a small phone.
       */}
      <QuickActions />

      {/* Partner's dynamic status line, verbatim from the PRD example — but only
          once there is a status to line up. */}
      {view.partnerCheckin ? (
        // Filled with their colour rather than outlined in it. This line and the
        // partner's duo card directly above are the same subject, so they read
        // as one block of "them" instead of two unrelated cards.
        <Card style={{ gap: space.xs, backgroundColor: theme.tint.iris.bg }}>
          <Text role="overline" color={theme.tint.iris.fg}>
            Right now
          </Text>
          <Text role="bodyStrong">
            {partnerName} feels {view.partnerCheckin.battery}% loved
            {view.partnerAsk ? ` — ${view.partnerAsk.toLowerCase()}.` : ' today.'}
          </Text>
        </Card>
      ) : (
        <Card style={{ gap: space.xs, backgroundColor: theme.color.surfaceSunken }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Right now
          </Text>
          <Text role="bodyStrong" color={theme.color.textSecondary}>
            {view.partner
              ? `Nothing from ${partnerName} yet today.`
              : 'Once your partner joins, their day shows up here.'}
          </Text>
        </Card>
      )}

      {/*
       * Reaching out, given the weight it was missing.
       *
       * This used to be a bare checkbox and a caption-sized "Not yet — open a
       * chat ›" at the very bottom of the screen — the one daily action the
       * product is built around, styled smaller than the ad slot beneath it.
       * It now carries its own heading, an explanation of what counts, and a
       * real button rather than a text link.
       */}
      <Card style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Reaching out
          </Text>
          <Text role="title3">Have you checked in on {partnerName} today?</Text>
          <Text role="body" color={theme.color.textSecondary}>
            A short message counts. It’s the reaching out that matters, not
            finding the right words.
          </Text>
        </View>

        {/*
         * `checked_on_partner` is a column on today's check-in row, so there is
         * nothing to write it to until that row exists. Rather than silently
         * failing the tap — or inventing a check-in with a mood the user never
         * gave, which would also feed the mutual-day streak — the card asks for
         * the check-in first.
         */}
        {view.canLogCheckedOnThem ? (
          <CheckboxRow
            label={`Yes, I've checked up on ${partnerName} today`}
            checked={view.checkedOnThem}
            onToggle={onToggleCheckedOnThem}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/checkin')}
            hitSlop={6}
            style={{ minHeight: layout.minTarget, justifyContent: 'center' }}
          >
            <Text role="bodyStrong" color={theme.color.textSecondary}>
              Check in first to log that you’ve checked up on {partnerName} ›
            </Text>
          </Pressable>
        )}

        <Button
          label={`Send ${partnerName} a message`}
          variant="secondary"
          full
          onPress={() => router.push('/handoff')}
        />
      </Card>

      {/* Entitlement is resolved once in `AdsProvider`; this renders only after
          the day has loaded, so there is always content above it. */}
      <AdSlot />
    </>
  );
}

/**
 * First paint.
 *
 * Laid out to the real screen's blocks rather than a generic stack of bars, so
 * the content that arrives lands where the placeholder already was. The quick
 * actions are not skeletoned — they are three static links that never load.
 */
function TodaySkeleton() {
  const theme = useTheme();

  return (
    <>
      <CoupleBannerSkeleton />
      <StreakSectionSkeleton />

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          How you’re both doing
        </Text>
        <DuoStateCardSkeleton tints={[theme.tint.rose.bg, theme.tint.iris.bg]} />
      </View>

      {/* Static links that never load, so they render for real even here — and
          in the same slot they occupy on the loaded screen, so nothing below
          them shifts when the fetch lands. */}
      <QuickActions />

      <Card style={{ gap: space.sm, backgroundColor: theme.tint.iris.bg }}>
        <Skeleton width={72} height={10} color={theme.color.surface} />
        <Skeleton width="86%" height={14} color={theme.color.surface} />
      </Card>

      <Card style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Skeleton width={82} height={10} />
          <Skeleton width="76%" height={18} />
          <Skeleton width="92%" height={12} />
        </View>
        <Skeleton width="70%" height={24} />
        <Skeleton height={50} round={radius.pill} />
      </Card>
    </>
  );
}
