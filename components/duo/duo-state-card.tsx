import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { MoodRing } from '@/components/duo/mood-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { cardGap, radius, space } from '@/constants/tokens';

export type Side = {
  name: string;
  /** Person colour — rose for you, iris for them. Never swapped. */
  color: string;
  /** The soft wash of the same colour, used as the card's fill. */
  tint: string;
  /** Null until that person has checked in today. */
  state: {
    moodColor: string;
    moodLabel: string;
    needLabel: string;
    battery: number;
  } | null;
};

type Props = {
  you: Side;
  /** Null while the hub has only one member in it. */
  partner: Side | null;
  /** Your card is tappable (opens check-in); theirs is read-only. */
  onPressYou?: () => void;
};

/**
 * The app's signature component: two equal cards, 12px gap, one per person.
 *
 * Each card is filled with its person's soft colour rather than plain white.
 * The person→colour mapping is the one piece of visual language the whole app
 * runs on — rose is you, iris is them, everywhere, without exception — and two
 * identical white rectangles were making the reader do that work from a 10px
 * label instead of from across the room.
 *
 * Each side has an empty state, because with real data a person who has not
 * checked in today has no mood. Inventing a neutral face for that case would
 * report a check-in that never happened, on the one screen whose entire job is
 * telling two people how the other is doing.
 */
export function DuoStateCard({ you, partner, onPressYou }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: cardGap }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          you.state
            ? `Your check-in. ${you.state.moodLabel}, ${you.state.battery} percent. Tap to update.`
            : 'You have not checked in today. Tap to check in.'
        }
        onPress={onPressYou}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}
      >
        <PersonCard side={you} interactive />
      </Pressable>

      <View style={{ flex: 1 }}>
        {partner ? <PersonCard side={partner} /> : <WaitingForPartnerCard />}
      </View>
    </View>
  );
}

function PersonCard({ side, interactive }: { side: Side; interactive?: boolean }) {
  const theme = useTheme();

  return (
    <Card style={{ flex: 1, gap: space.sm, alignItems: 'flex-start', backgroundColor: side.tint }}>
      <Text role="overline" color={side.color}>
        {side.name}
      </Text>

      <MoodRing color={side.state?.moodColor ?? side.color} battery={side.state?.battery ?? null} />

      <View style={{ gap: 2 }}>
        <Text role="cardTitle" color={side.state ? undefined : theme.color.textSecondary}>
          {side.state ? side.state.moodLabel : 'No check-in'}
        </Text>
        <Text role="caption" color={theme.color.textSecondary}>
          {side.state
            ? side.state.needLabel
            : interactive
              ? 'Nothing logged today'
              : 'They haven’t yet today'}
        </Text>
      </View>

      {interactive ? (
        // A chip rather than a caption: on a tinted card the old grey overline
        // read as another label, and this is the only tap target on the row.
        <View
          style={{
            paddingHorizontal: space.md - 2,
            paddingVertical: space.xs,
            borderRadius: radius.pill,
            backgroundColor: theme.color.surface,
          }}
        >
          <Text role="overline" color={side.color}>
            {side.state ? 'Tap to update' : 'Tap to check in'}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/** No second member yet — the hub exists but the invite has not been redeemed. */
function WaitingForPartnerCard() {
  const theme = useTheme();

  return (
    <Card
      style={{
        flex: 1,
        gap: space.sm,
        alignItems: 'flex-start',
        backgroundColor: theme.color.surfaceSunken,
      }}
    >
      <Text role="overline" color={theme.color.textTertiary}>
        Them
      </Text>
      <MoodRing color={theme.color.border} battery={null} />
      <View style={{ gap: 2 }}>
        <Text role="cardTitle" color={theme.color.textSecondary}>
          Not here yet
        </Text>
        <Text role="caption" color={theme.color.textSecondary}>
          Share your code to pair
        </Text>
      </View>
    </Card>
  );
}

/** First-load placeholder. Same two cards, same heights, no numbers. */
export function DuoStateCardSkeleton({ tints }: { tints: [string, string] }) {
  return (
    <View style={{ flexDirection: 'row', gap: cardGap }}>
      {tints.map((tint, i) => (
        <Card
          key={i}
          style={{ flex: 1, gap: space.sm, alignItems: 'flex-start', backgroundColor: tint }}
        >
          <Skeleton width={44} height={10} color="rgba(255,255,255,0.65)" />
          <Skeleton width={58} height={58} round={29} color="rgba(255,255,255,0.65)" />
          <View style={{ gap: space.xs }}>
            <Skeleton width={72} height={12} color="rgba(255,255,255,0.65)" />
            <Skeleton width={96} height={10} color="rgba(255,255,255,0.65)" />
          </View>
          <Skeleton width={78} height={22} round={radius.pill} color="rgba(255,255,255,0.65)" />
        </Card>
      ))}
    </View>
  );
}
