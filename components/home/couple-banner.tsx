import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { StreakBadge } from '@/components/ui/streak-badge';
import { Text } from '@/components/ui/text';
import { gradients, radius, shadow, space } from '@/constants/tokens';

export type BannerPerson = {
  name: string;
  avatarUrl: string | null;
};

type Props = {
  you: BannerPerson;
  /** Null while the hub has only one member. */
  partner: BannerPerson | null;
  /** Null when the couple has never set a start date. */
  togetherLabel: string | null;
  streak: number;
  onPressStreak: () => void;
  /** Opens the place the start date is set. Only reachable while it is unset. */
  onPressTogether: () => void;
};

/**
 * Couple photo + "Together 2 years, 4 months" counter (PRD Module 1).
 *
 * The one loud surface on the screen. Everything under it is a white or
 * soft-tinted card, so the hero carries the colour for the whole page: the
 * rose→iris `duo` gradient is literally the two person colours blended, which
 * is the thing this card is *about*, and the amber streak chip is the one warm
 * accent against it. A screen where every card competes at this weight would be
 * a worse screen — the rhythm is loud, soft, soft, quiet, going down.
 *
 * The photos are real `profiles.avatar_url` values. They will be null for
 * everyone until the storage bucket lands (README open question 5), so the
 * fallback is the person's initial rather than the old "Add" label — that label
 * advertised an upload this build cannot do, and a dead affordance on the first
 * card of the first screen is worse than no affordance.
 */
export function CoupleBanner({
  you,
  partner,
  togetherLabel,
  streak,
  onPressStreak,
  onPressTogether,
}: Props) {
  return (
    <View style={heroShape}>
      <Glow />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar person={you} />
          {partner ? <Avatar person={partner} overlap /> : <EmptyAvatar />}
        </View>
        <StreakBadge count={streak} onPress={onPressStreak} />
      </View>

      <View style={{ gap: space.xs }}>
        <Text role="overline" color="rgba(255,255,255,0.75)">
          Together
        </Text>
        {/*
         * The empty state is a prompt, not a label.
         *
         * `together_since` has never been settable, so this read "Just getting
         * started" for every couple forever and looked like a fact about them
         * rather than a blank in the app. Now that Settings can fill it, the
         * placeholder points at the field that does it.
         */}
        {togetherLabel ? (
          <Text role="title2" color="#FFFFFF">
            {togetherLabel}
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set how long you have been together"
            onPress={onPressTogether}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text role="title2" color="#FFFFFF">
              Add your start date ›
            </Text>
          </Pressable>
        )}
        {partner ? (
          <Text role="caption" color="rgba(255,255,255,0.72)">
            {you.name} & {partner.name}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Two blown-out highlights in the top corner, clipped by the card.
 *
 * A flat two-stop gradient over this much area reads as a printed swatch. These
 * give it somewhere to catch the light, at an alpha low enough that they never
 * become shapes you notice on their own.
 */
function Glow() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      <View
        style={{
          position: 'absolute',
          top: -74,
          right: -46,
          width: 172,
          height: 172,
          borderRadius: radius.pill,
          backgroundColor: 'rgba(255,255,255,0.13)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 26,
          right: -88,
          width: 132,
          height: 132,
          borderRadius: radius.pill,
          backgroundColor: 'rgba(255,255,255,0.09)',
        }}
      />
    </View>
  );
}

function Avatar({ person, overlap }: { person: BannerPerson; overlap?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={person.name}
      // White rings, not the person colours: rose and iris are what the card is
      // already made of, so a ring in either one vanishes into it.
      style={[avatarShape, { borderColor: 'rgba(255,255,255,0.92)', marginLeft: overlap ? -14 : 0 }]}
    >
      {person.avatarUrl ? (
        <Image
          source={{ uri: person.avatarUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          // Cached across sessions: this is the first thing on the first screen,
          // and re-fetching it on every cold start is the most visible possible
          // place to spend a network round trip.
          cachePolicy="memory-disk"
        />
      ) : (
        <Text role="title3" color="#FFFFFF">
          {person.name.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

/** The second slot before anyone has taken it. */
function EmptyAvatar() {
  return (
    <View
      accessible
      accessibilityLabel="No partner yet"
      style={[
        avatarShape,
        {
          borderColor: 'rgba(255,255,255,0.55)',
          borderStyle: 'dashed',
          backgroundColor: 'rgba(255,255,255,0.10)',
          marginLeft: -14,
        },
      ]}
    >
      <Text role="title3" color="rgba(255,255,255,0.8)">
        +
      </Text>
    </View>
  );
}

const heroShape = {
  borderRadius: radius.xl,
  borderCurve: 'continuous',
  padding: space.lg,
  gap: space.lg,
  // Clips the highlights. Also what keeps the gradient inside the corner curve.
  overflow: 'hidden',
  experimental_backgroundImage: gradients.duo,
  boxShadow: shadow.hero,
} as const;

const avatarShape = {
  width: 54,
  height: 54,
  borderRadius: 27,
  borderWidth: 3,
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  backgroundColor: 'rgba(255,255,255,0.18)',
} as const;

/**
 * First-load placeholder.
 *
 * Keeps the gradient and swaps only the content for translucent blocks — the
 * alternative, a grey card that turns magenta half a second later, is a bigger
 * visual event than the load it is covering for.
 */
export function CoupleBannerSkeleton() {
  const block = 'rgba(255,255,255,0.22)';

  return (
    <View style={heroShape}>
      <Glow />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Skeleton width={54} height={54} round={27} color={block} />
          <View style={{ marginLeft: -14 }}>
            <Skeleton width={54} height={54} round={27} color={block} />
          </View>
        </View>
        <Skeleton width={56} height={34} round={radius.md - 2} color={block} />
      </View>

      <View style={{ gap: space.sm }}>
        <Skeleton width={64} height={10} color={block} />
        <Skeleton width={168} height={20} color={block} />
      </View>
    </View>
  );
}
