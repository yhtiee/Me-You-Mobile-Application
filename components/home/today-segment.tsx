import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AdSlot } from '@/components/ui/ad-slot';
import { Card } from '@/components/ui/card';
import { CheckboxRow } from '@/components/ui/checkbox-row';
import { CoupleBanner, CoupleBannerSkeleton } from '@/components/home/couple-banner';
import { DuoStateCard, DuoStateCardSkeleton } from '@/components/duo/duo-state-card';
import { ErrorState } from '@/components/ui/error-state';
import { ProfilePrompt } from '@/components/home/profile-prompt';
import { QuickActions } from '@/components/home/quick-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useHome, type HomeView } from '@/hooks/use-home';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, space } from '@/constants/tokens';

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
      />

      <QuickActions />

      {/* Between the quick actions and the day's check-in: high enough to be
          seen on open, low enough that it never displaces the thing the screen
          exists for. Renders nothing once the profile is complete. */}
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

      <Card style={{ gap: space.md }}>
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
          <Pressable accessibilityRole="button" onPress={() => router.push('/checkin')} hitSlop={6}>
            <Text role="bodyStrong" color={theme.color.textSecondary}>
              Check in first to log that you’ve checked up on {partnerName} ›
            </Text>
          </Pressable>
        )}

        <Pressable accessibilityRole="button" onPress={() => router.push('/handoff')} hitSlop={6}>
          <Text role="caption" color={palette.brand.rose}>
            Not yet — open a chat ›
          </Text>
        </Pressable>
      </Card>

      <AdSlot show={!view.isPremium} />
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
      <QuickActions />

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          How you’re both doing
        </Text>
        <DuoStateCardSkeleton tints={[theme.tint.rose.bg, theme.tint.iris.bg]} />
      </View>

      <Card style={{ gap: space.sm, backgroundColor: theme.tint.iris.bg }}>
        <Skeleton width={72} height={10} color={theme.color.surface} />
        <Skeleton width="86%" height={14} color={theme.color.surface} />
      </Card>

      <Card style={{ gap: space.md }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width={128} height={12} />
      </Card>
    </>
  );
}

/** Kept here so the deep-link intent is documented next to its only caller. */
export async function openChatWith(scheme: string, fallback: string) {
  const canOpen = await Linking.canOpenURL(scheme);
  await Linking.openURL(canOpen ? scheme : fallback);
}
