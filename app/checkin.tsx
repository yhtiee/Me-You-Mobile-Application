import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { MoodPicker } from '@/components/duo/mood-picker';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SheetBody } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAsyncData } from '@/hooks/use-async-data';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { fetchMyCheckin, saveMyCheckin } from '@/lib/home';
import { MOOD_LABELS, type MoodKey } from '@/types/domain';
import { palette, radius, space } from '@/constants/tokens';

/** What an untouched check-in opens on. Steady, half a battery — not an opinion. */
const DEFAULT_DRAFT = { mood: 'neutral' as MoodKey, battery: 50 };

/**
 * The six stops, as the segmented control wants them.
 *
 * Strings because `SegmentedControl` keys on a string union; the numbers go
 * back through `Number()` on change. Module scope so the array identity is
 * stable across renders.
 */
const BATTERY_STOPS = [10, 25, 50, 75, 90, 100].map((n) => ({
  value: String(n),
  label: String(n),
}));

/** Your own row, so the sheet is right if you saved it on your other device. */
const CHECKIN_TABLES = ['check_ins'] as const;

/**
 * Daily mood & battery meter (PRD Module 1).
 *
 * Reads today's row so re-opening the sheet shows what you already saved rather
 * than resetting you to neutral, and writes through `saveMyCheckin`, whose
 * upsert makes a second save of the day an amendment. Home picks the change up
 * when it regains focus.
 */
export default function Checkin() {
  const theme = useTheme();
  const toast = useToast();
  const { user, coupleId } = useAuth();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw new Error('Your session ended. Log in again to continue.');
    return fetchMyCheckin(userId);
  }, [userId]);

  const { data, loading, error, refetch } = useAsyncData(userId ? load : null, CHECKIN_TABLES);

  /**
   * Null until the first tap, then it wins outright. Deriving the value this way
   * rather than seeding state from an effect means a slow fetch that lands after
   * the user has already picked a mood cannot overwrite their choice.
   */
  const [draft, setDraft] = useState<{ mood: MoodKey; battery: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const current = draft ?? (data ? { mood: data.mood, battery: data.battery } : DEFAULT_DRAFT);

  /** Sad or Stressed triggers the "what do you need?" prompt (PRD Module 1). */
  const needsFollowUp = current.mood === 'sad' || current.mood === 'stressed';
  const moodColor = palette.mood[current.mood];

  const save = async () => {
    if (!userId || !coupleId) {
      toast.error('Your session ended. Log in again to continue.');
      return;
    }

    setSaving(true);
    try {
      await saveMyCheckin({
        coupleId,
        userId,
        mood: current.mood,
        battery: current.battery,
        /*
         * `undefined` leaves any existing ask alone — the follow-up sheet is
         * about to set it. A mood that no longer asks for anything clears it,
         * because leaving yesterday's "needs space" attached to a Happy
         * check-in would tell the partner something untrue.
         */
        need: needsFollowUp ? undefined : null,
      });

      if (needsFollowUp) router.replace('/need');
      else router.back();
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save your check-in.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetBody title="How are you, honestly?" subtitle="Only the two of you ever see this.">
      {loading ? (
        <CheckinSkeleton />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/*
           * The form scrolls; the footer below it does not.
           *
           * This is what actually guarantees the save button is reachable —
           * more than any detent does. At a large Dynamic Type setting the mood
           * tiles and the six battery buttons grow past any height we could
           * have picked, and without this the button goes back under the fold.
           */}
          {/*
           * `xxl` between the two blocks, `sm` inside them.
           *
           * Both used to sit on the same 16pt rhythm as everything else in the
           * sheet, so the mood tiles, the battery label and the stepper read as
           * one undifferentiated stack — the "clustered" look on a small
           * iPhone. Making the gap between groups three times the gap within
           * them is what turns it into two things instead of five.
           */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: space.xxl, paddingBottom: space.xs }}
            showsVerticalScrollIndicator={false}
          >
            {/* Labelled to match the battery block below. The mood tiles used
                to be the one unlabelled control in the sheet, which left the
                two groups looking like different kinds of thing. */}
            <View style={{ gap: space.sm }}>
              <Text role="overline" color={theme.color.textTertiary}>
                Mood
              </Text>
              <MoodPicker value={current.mood} onChange={(mood) => setDraft({ ...current, mood })} />
            </View>

            <View style={{ gap: space.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <Text role="overline" color={theme.color.textTertiary}>
                  Battery
                </Text>
                <Text role="title3" tabular color={moodColor}>
                  {current.battery}%
                </Text>
              </View>

              {/*
               * One track, not six buttons.
               *
               * These were six `Button`s at `flex: 1`. On a 375pt iPhone that
               * is roughly 48pt each, and the selected one carried `primary`'s
               * rose drop shadow — six pill CTAs shoulder to shoulder, each
               * glowing. `Button` is the wrong primitive for a value picker:
               * it is built to be the one thing you press on a screen.
               *
               * The segmented control reads as a single object with a position
               * in it, which is what a battery level actually is. The separate
               * progress bar that used to sit underneath is gone with it — the
               * percentage was being drawn three times (numeral, stepper, bar)
               * and two of those were saying the same thing twice.
               */}
              <SegmentedControl
                options={BATTERY_STOPS}
                value={String(current.battery)}
                onChange={(value) => setDraft({ ...current, battery: Number(value) })}
              />
            </View>
          </ScrollView>

          {/* Pinned to the bottom of the sheet, outside the scroll area. */}
          <View style={{ gap: space.sm }}>
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
              label={saving ? 'Saving…' : 'Save today’s check-in'}
              full
              disabled={saving}
              onPress={() => void save()}
            />

            {data ? (
              <Text role="caption" center color={theme.color.textTertiary}>
                Saved today as {MOOD_LABELS[data.mood].toLowerCase()} · {data.battery}%
              </Text>
            ) : null}
          </View>
        </>
      )}
    </SheetBody>
  );
}

/**
 * Same blocks as the form, at the same heights — including the button, so the
 * shape of the sheet does not change when the fetch lands.
 */
function CheckinSkeleton() {
  return (
    <View style={{ gap: space.xxl }}>
      <View style={{ gap: space.sm }}>
        <Skeleton width={44} height={10} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1 }}>
              <Skeleton height={68} round={radius.md} />
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width={64} height={10} />
          <Skeleton width={48} height={18} />
        </View>
        {/* One track now, matching the control it stands in for. */}
        <Skeleton height={48} round={radius.pill} />
      </View>

      <View style={{ gap: space.sm }}>
        <Skeleton height={50} round={radius.pill} />
        <Skeleton width="55%" height={12} />
      </View>
    </View>
  );
}
