import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Glyph } from '@/components/ui/glyph';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { usePlayActivity } from '@/hooks/use-play';
import { PLAY_BY_KEY } from '@/constants/play';
import { radius, space } from '@/constants/tokens';
import type { PlayActivity as PlayActivityItem } from '@/lib/play';

type Props = {
  /** Their display name, for lines that are about them. */
  partnerName: string;
};

/**
 * What the two of you have actually been playing.
 *
 * The hub could previously only state totals — "4 flips", "12 spins" — which
 * says how much a couple has used the app and nothing about what happened. The
 * part worth reopening the tab for is that your partner spun the wheel an hour
 * ago and it landed on them.
 *
 * Renders nothing at all when there is no history. A "no activity yet" card
 * under six game tiles is a card telling someone off for not having played the
 * games directly above it.
 */
export function PlayActivityFeed({ partnerName }: Props) {
  const theme = useTheme();
  const { items, userId, loading, error } = usePlayActivity();

  // Silent on error, deliberately: this is a summary under the games it
  // summarises, and a retry box in that slot would be louder than the thing it
  // is standing in for. The hub's own error state covers a real outage.
  if (error || (!loading && items.length === 0)) return null;

  return (
    <View style={{ gap: space.md, marginTop: space.sm }}>
      <View style={{ gap: space.xs }}>
        <Text role="title3">Lately</Text>
        <Text role="caption" color={theme.color.textSecondary}>
          The last few things you settled, guessed and matched on.
        </Text>
      </View>

      <Card padded={false} style={{ paddingHorizontal: space.lg, paddingVertical: space.xs }}>
        {loading
          ? [0, 1, 2].map((i) => <ActivityRowSkeleton key={i} last={i === 2} />)
          : items.map((item, index) => (
              <ActivityRow
                key={item.id}
                item={item}
                userId={userId}
                partnerName={partnerName}
                last={index === items.length - 1}
              />
            ))}
      </Card>
    </View>
  );
}

function ActivityRow({
  item,
  userId,
  partnerName,
  last,
}: {
  item: PlayActivityItem;
  userId: string | null;
  partnerName: string;
  last: boolean;
}) {
  const theme = useTheme();
  const { line, note } = describe(item, userId, partnerName);

  // The game's own tint, so a row is identifiable by colour before it is read —
  // the same job the colour does on the tiles above.
  const tint = theme.play[item.kind === 'trivia' ? 'trivia' : item.kind];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.color.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tint.bg,
        }}
      >
        <Glyph size={15}>{PLAY_BY_KEY[item.kind].glyph}</Glyph>
      </View>

      <View style={{ flex: 1, gap: 1 }}>
        <Text role="bodyStrong" numberOfLines={1}>
          {line}
        </Text>
        {note ? (
          <Text role="caption" color={theme.color.textSecondary} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>

      <Text role="caption" color={theme.color.textTertiary}>
        {ago(item.occurredAt)}
      </Text>
    </View>
  );
}

/**
 * One event, as a sentence.
 *
 * Written per game rather than from a generic template, because the interesting
 * noun is different every time: for the coin it is who won, for the wheel it is
 * what it landed on, for trivia it is the score, for the picker it is the thing
 * you both said yes to. A single "X did Y" shape would flatten all four into
 * the same non-statement.
 *
 * Ids are resolved here and only here — the server cannot know which of the two
 * people is reading.
 */
function describe(
  item: PlayActivityItem,
  userId: string | null,
  partnerName: string
): { line: string; note: string | null } {
  const actor = item.actorId === null ? null : item.actorId === userId ? 'You' : partnerName;

  switch (item.kind) {
    case 'coin': {
      const winner = item.subjectId === userId ? 'you' : partnerName;
      return {
        line: `The coin picked ${winner}`,
        note: item.label ?? (actor ? `${actor} flipped it` : null),
      };
    }
    case 'wheel':
      return {
        line: item.label ? `The wheel said ${item.label}` : 'The wheel decided',
        note: actor ? `${actor} spun it` : null,
      };
    case 'trivia': {
      const about = item.subjectId === userId ? 'you' : partnerName;
      return {
        line: `${actor ?? 'Someone'} scored ${item.label ?? ''}`.trim(),
        note: `Guessing about ${about}`,
      };
    }
    case 'picker':
      return {
        // The one line with no actor, and it says so: a match is the only thing
        // in this feed neither of you did on your own.
        line: `You both liked ${item.label ?? 'the same thing'}`,
        note: item.detail,
      };
  }
}

/**
 * Coarse relative time. Minutes for the last hour, then hours, then days.
 *
 * No "just now" for anything under a minute — a feed row that says "just now"
 * and still says it ten minutes later, because nothing re-rendered, is worse
 * than one that rounds to "1m".
 */
function ago(iso: string, now = Date.now()): string {
  const minutes = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : `${Math.round(days / 7)}w`;
}

function ActivityRowSkeleton({ last }: { last: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.color.border,
      }}
    >
      <Skeleton width={34} height={34} round={radius.sm} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Skeleton width="62%" height={14} />
        <Skeleton width="38%" height={11} />
      </View>
      <Skeleton width={22} height={11} />
    </View>
  );
}
