import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Glyph } from '@/components/ui/glyph';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, radius, space } from '@/constants/tokens';
import { levels } from '@/mocks/couple';

type Props = {
  count: number;
  level: number;
  /** Both halves checked in today. False puts the streak at risk tonight. */
  bothCheckedIn: boolean;
  onPress: () => void;
};

/**
 * The streak, given a section of its own under the banner.
 *
 * The badge stays on the banner — it is the tap target people already know, and
 * removing it to avoid "duplication" would take away the affordance to teach a
 * new one. What the badge cannot do is show *progress*: it is a 34px pill with
 * a number in it, so the level, the next rung and how far along you are had
 * nowhere to live except the modal behind it. That is the gap this fills.
 *
 * Deliberately quieter than the banner above it. The banner is the one loud
 * surface on Home; a second gradient directly beneath it would leave the screen
 * with two competing heroes and nothing to rest on. This is a normal card with
 * one amber accent — the same warm note the badge carries.
 *
 * The ladder is the static `levels` list, matching `useStreak`. It is reference
 * data identical to what `0008_seed.sql` puts in the `levels` table, and both
 * places read it from the bundle rather than spending a query on five rows.
 */
export function StreakSection({ count, level, bothCheckedIn, onPress }: Props) {
  const theme = useTheme();

  const current = levels.findLast((l) => l.level <= level) ?? levels[0];
  const next = levels.find((l) => l.level > level) ?? null;
  const progress = next ? Math.min(1, (level - current.level) / (next.level - current.level)) : 1;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Streak: ${count} days, level ${level}, ${current.title}`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: theme.tint.amber.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Fixed size: at the largest OS text settings a scaling flame is
                taller than the tile holding it. Same rule as `StreakBadge`. */}
            <Glyph size={20}>🔥</Glyph>
          </View>

          <View style={{ flex: 1, gap: 1 }}>
            {/* Tabular, like every other counter in the app — a streak that
                shifts width as it ticks from 9 to 10 reads as a layout bug. */}
            <Text role="title3" tabular>
              {count} {count === 1 ? 'day' : 'days'}
            </Text>
            <Text role="caption" color={theme.color.textSecondary}>
              Level {level} · {current.title}
            </Text>
          </View>

          <Text role="body" color={theme.color.textTertiary}>
            ›
          </Text>
        </View>

        {next ? (
          <View style={{ gap: space.sm }}>
            <ProgressBar value={progress} color={palette.brand.amber} />
            <Text role="caption" color={theme.color.textSecondary}>
              {next.level - level} {next.level - level === 1 ? 'level' : 'levels'} to{' '}
              {next.title}
            </Text>
          </View>
        ) : (
          <Text role="caption" color={theme.tint.amber.muted}>
            Top of the ladder. Nothing left to climb.
          </Text>
        )}

        {/*
         * Only when the streak is actually in danger. A standing "keep it up"
         * line would be wallpaper within a week, and then the one evening it
         * matters it would not be read either.
         */}
        {!bothCheckedIn ? (
          <View
            style={{
              flexDirection: 'row',
              gap: space.sm,
              padding: space.md,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: theme.tint.rose.bg,
            }}
          >
            <Text role="caption" color={theme.tint.rose.fg} style={{ flex: 1 }}>
              You both need to check in before midnight to keep this going.
            </Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

/** Same blocks at the same heights, so the card does not resize on load. */
export function StreakSectionSkeleton() {
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Skeleton width={44} height={44} round={radius.md} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Skeleton width={96} height={18} />
          <Skeleton width={132} height={12} />
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Skeleton height={8} round={4} />
        <Skeleton width="52%" height={12} />
      </View>
    </Card>
  );
}
