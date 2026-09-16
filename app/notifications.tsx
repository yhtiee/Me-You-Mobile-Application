import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Glyph } from '@/components/ui/glyph';
import { Screen } from '@/components/ui/screen';
import { AdSlot } from '@/components/ui/ad-slot';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { partnerNameInSentence, useCouplePeople } from '@/hooks/use-couple-people';
import { useTheme } from '@/components/providers/theme-provider';
import { useNotifications } from '@/hooks/use-notifications';
import { MOOD_LABELS, type MoodKey } from '@/types/domain';
import { radius, space } from '@/constants/tokens';
import type { AppNotification } from '@/lib/notifications-feed';

/**
 * Where the header's bell lands.
 *
 * This shipped as a deliberately empty screen with a note saying it would grow
 * a list "when the feed exists". 0020 built the feed — rows written by database
 * triggers whenever the other person checks in, flips, spins, finishes a trivia
 * round, or matches with you on the picker.
 *
 * It sits in the root stack rather than inside a tab so the bell reaches it
 * from all four tabs without four copies of the route.
 */
export default function Notifications() {
  const theme = useTheme();
  const people = useCouplePeople();
  // Rows open a sentence with the name ("Your partner checked in"), so they
  // take the capitalised fallback; the empty-state line is mid-sentence.
  const rowName = people.partner?.name ?? 'Your partner';
  const { items, userId, loading, error, refetch } = useNotifications();

  if (loading) {
    return (
      <Screen gap={space.md}>
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <RowSkeleton key={i} last={i === 3} />
          ))}
        </Card>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen gap={space.md}>
        <ErrorState message={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen gap={space.md}>
        <Text role="body" color={theme.color.textSecondary}>
          Nudges, check-ins and anything {partnerNameInSentence(people)} does in Play will show up
          here.
        </Text>
        <EmptyState label="You’re all caught up." />
      </Screen>
    );
  }

  return (
    <Screen gap={space.md}>
      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        {items.map((item, index) => (
          <NotificationRow
            key={item.id}
            item={item}
            userId={userId}
            partnerName={rowName}
            last={index === items.length - 1}
          />
        ))}
      </Card>

      <AdSlot />
    </Screen>
  );
}

function NotificationRow({
  item,
  userId,
  partnerName,
  last,
}: {
  item: AppNotification;
  userId: string | null;
  partnerName: string;
  last: boolean;
}) {
  const theme = useTheme();
  const { glyph, line, note } = describe(item, userId, partnerName);

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
          width: 36,
          height: 36,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          // Unread rows carry the brand tint; read ones go quiet. The list is
          // marked read on open, so this is mostly telling you what arrived
          // while you were on the screen.
          backgroundColor: item.readAt ? theme.color.surfaceSunken : theme.tint.rose.bg,
        }}
      >
        <Glyph size={16}>{glyph}</Glyph>
      </View>

      <View style={{ flex: 1, gap: 1 }}>
        <Text role="bodyStrong">{line}</Text>
        {note ? (
          <Text role="caption" color={theme.color.textSecondary} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>

      <Text role="caption" color={theme.color.textTertiary}>
        {ago(item.createdAt)}
      </Text>
    </View>
  );
}

/**
 * One row, as a sentence.
 *
 * The wording lives here rather than in the database for the reason stated in
 * 0020: storing the sentence would freeze today's copy into rows that outlive
 * it, and a rename six months from now would leave the feed reading in two
 * different voices. The trigger stores what happened; this decides how to say
 * it.
 *
 * The `default` branch is load-bearing rather than defensive. A newer client
 * writing a kind this build has never heard of should produce a dull row, not a
 * blank one or a crash.
 */
function describe(
  item: AppNotification,
  userId: string | null,
  partnerName: string
): { glyph: string; line: string; note: string | null } {
  const who = item.actorId && item.actorId === userId ? 'You' : partnerName;
  const p = item.payload;

  switch (item.kind) {
    case 'checkin': {
      const mood = typeof p.mood === 'string' ? MOOD_LABELS[p.mood as MoodKey] : null;
      const battery = typeof p.battery === 'number' ? p.battery : null;
      return {
        glyph: '💗',
        line: `${who} checked in`,
        note:
          mood && battery !== null
            ? `Feeling ${mood.toLowerCase()} · ${battery}% loved`
            : 'Open Home to see how they’re doing.',
      };
    }
    case 'play.coin':
      return {
        glyph: '🪙',
        line: `${who} flipped the coin`,
        note: typeof p.stake === 'string' && p.stake ? p.stake : 'Someone had to go first.',
      };
    case 'play.wheel':
      return {
        glyph: '🎡',
        line: `${who} spun the wheel`,
        note: typeof p.landed_on === 'string' ? `It landed on ${p.landed_on}.` : null,
      };
    case 'play.trivia': {
      const score = typeof p.score === 'number' ? p.score : null;
      const total = typeof p.total === 'number' ? p.total : null;
      return {
        glyph: '🎯',
        line: `${who} took the quiz`,
        note: score !== null && total !== null ? `Scored ${score} out of ${total}.` : null,
      };
    }
    case 'play.match':
      return {
        glyph: '🍿',
        // No actor: a match is the one thing here neither of you did alone.
        line: 'You matched',
        note: typeof p.title === 'string' ? `You both liked ${p.title}.` : null,
      };
    default:
      return { glyph: '🔔', line: `${who} did something`, note: null };
  }
}

/** Same rounding as the Play feed, so two lists never disagree about "2h". */
function ago(iso: string, now = Date.now()): string {
  const minutes = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : `${Math.round(days / 7)}w`;
}

function RowSkeleton({ last }: { last: boolean }) {
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
      <Skeleton width={36} height={36} round={radius.sm} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Skeleton width="54%" height={14} />
        <Skeleton width="72%" height={11} />
      </View>
      <Skeleton width={22} height={11} />
    </View>
  );
}
