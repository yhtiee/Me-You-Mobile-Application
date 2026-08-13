import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAsyncData } from '@/hooks/use-async-data';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { fetchUsSnapshot, saveLoveLanguages, toShares } from '@/lib/us';
import { LOVE_LANGUAGES } from '@/constants/relationship';
import { radius, space } from '@/constants/tokens';
import type { LoveLanguage } from '@/types/domain';

const STEPS = [1, 2, 3, 4, 5];
const DEFAULT_RATING = 3;

/** The five steps get taller left to right, so the control looks like what it sets. */
const STEP_HEIGHT = [22, 28, 34, 40, 46];
const STEP_ROW = 46;

type Ratings = Record<LoveLanguage['key'], number>;

/**
 * Rate what makes you feel loved.
 *
 * Collects 1-5 importance ratings, not percentages. The table stores shares of
 * 100 and the schema names the API layer as the thing that normalises them —
 * but asking a person to make five numbers add up to 100 is asking them to do
 * arithmetic to express a feeling. Five taps do the same job, and `toShares`
 * turns them into the shares the table wants.
 *
 * The spectrum bar at the top is the whole design. Five separate sliders read
 * as five independent questions; one bar that visibly redistributes on every
 * tap makes the trade-off — more of this means less of that — the thing you
 * are actually doing, which is also what the stored data means.
 *
 * Only ever edits your own row set: the policy on `love_languages` is
 * `user_id = auth.uid()`, and a screen that let you answer on your partner's
 * behalf would be wrong even if the database allowed it.
 */
export default function LoveLanguages() {
  const theme = useTheme();
  const toast = useToast();
  const { user, coupleId } = useAuth();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!coupleId || !userId) throw new Error('You’re not in a hub yet.');
    return fetchUsSnapshot(coupleId, userId);
  }, [coupleId, userId]);

  const { data, loading, error, refetch } = useAsyncData(coupleId && userId ? load : null);

  const [edited, setEdited] = useState<Ratings | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Percentages back to a 1-5 scale, relative to whichever language scored
   * highest. The round trip is lossy — 34/26/20/12/8 does not come back as the
   * exact taps that produced it — which is acceptable for a preference the user
   * is about to re-answer anyway, and much better than opening the editor on a
   * blank slate every time.
   */
  const stored: Ratings | null = data
    ? (() => {
        const mine = LOVE_LANGUAGES.map(
          (l) =>
            data.loveLanguages.find((row) => row.userId === userId && row.key === l.key)?.value ?? 0
        );
        const top = Math.max(...mine);
        return Object.fromEntries(
          LOVE_LANGUAGES.map((l, i) => [
            l.key,
            top === 0 ? DEFAULT_RATING : Math.max(1, Math.round((mine[i] / top) * 5)),
          ])
        ) as Ratings;
      })()
    : null;

  const ratings = edited ?? stored;

  const submit = async () => {
    if (!userId || !ratings) return;

    setSaving(true);
    try {
      await saveLoveLanguages(
        userId,
        LOVE_LANGUAGES.map((l) => ({ key: l.key, rating: ratings[l.key] }))
      );
      toast.success('Saved. Your partner sees this on Us.');
      router.back();
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) {
    return (
      <Screen gap={space.xl}>
        <ErrorState message={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (loading || !ratings) return <LoveLanguagesSkeleton />;

  const shares = toShares(LOVE_LANGUAGES.map((l) => ({ key: l.key, rating: ratings[l.key] })));
  const leaderIndex = shares.reduce((best, s, i) => (s.value > shares[best].value ? i : best), 0);

  return (
    <Screen gap={space.xl} bottomPad={space.huge}>
      {/* The spectrum: one whole, divided five ways, redrawn on every tap. */}
      <View style={{ gap: space.md }}>
        <View
          accessible
          accessibilityLabel={LOVE_LANGUAGES.map(
            (l, i) => `${l.label} ${shares[i].value} percent`
          ).join(', ')}
          style={{
            flexDirection: 'row',
            height: 18,
            borderRadius: radius.pill,
            overflow: 'hidden',
            backgroundColor: theme.color.surfaceSunken,
          }}
        >
          {LOVE_LANGUAGES.map((language, i) => (
            <View
              key={language.key}
              // `flex` on a share of zero collapses the segment to nothing,
              // which is exactly right — a language nobody rated should not
              // hold a sliver of the bar.
              style={{ flex: shares[i].value, backgroundColor: language.color }}
            />
          ))}
        </View>

        <Text role="body" color={theme.color.textSecondary}>
          Right now,{' '}
          <Text role="bodyStrong" color={LOVE_LANGUAGES[leaderIndex].color}>
            {LOVE_LANGUAGES[leaderIndex].label}
          </Text>{' '}
          matters most to you. Tap to change any of them — there are no wrong answers.
        </Text>
      </View>

      {LOVE_LANGUAGES.map((language, i) => (
        <Card key={language.key} style={{ gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                marginTop: 5,
                backgroundColor: language.color,
              }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text role="cardTitle">{language.label}</Text>
              <Text role="caption" color={theme.color.textSecondary}>
                {language.blurb}
              </Text>
            </View>
            <Text role="title3" tabular color={language.color}>
              {shares[i].value}%
            </Text>
          </View>

          <View
            style={{ flexDirection: 'row', gap: space.sm, height: STEP_ROW, alignItems: 'flex-end' }}
          >
            {STEPS.map((step) => {
              const active = step <= ratings[language.key];
              return (
                <Pressable
                  key={step}
                  accessibilityRole="button"
                  accessibilityState={{ selected: step === ratings[language.key] }}
                  accessibilityLabel={`${language.label}, rate ${step} of 5`}
                  onPress={() => setEdited({ ...ratings, [language.key]: step })}
                  // Full-height target behind a short bar: the first step is
                  // 22px tall and would otherwise be half a tap target.
                  style={({ pressed }) => ({
                    flex: 1,
                    height: STEP_ROW,
                    justifyContent: 'flex-end',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View
                    style={{
                      height: STEP_HEIGHT[step - 1],
                      borderRadius: radius.sm,
                      borderCurve: 'continuous',
                      backgroundColor: active ? language.color : theme.color.surfaceSunken,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}

      <Button
        label={saving ? 'Saving…' : 'Save'}
        full
        disabled={saving}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

function LoveLanguagesSkeleton() {
  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.md }}>
        <Skeleton height={18} round={radius.pill} />
        <Skeleton width="80%" height={14} />
      </View>

      {LOVE_LANGUAGES.map((language) => (
        <Card key={language.key} style={{ gap: space.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg }}>
            <View style={{ flex: 1, gap: space.sm }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="80%" height={10} />
            </View>
            <Skeleton width={44} height={18} />
          </View>
          <Skeleton height={STEP_ROW} round={radius.sm} />
        </Card>
      ))}
    </Screen>
  );
}
