import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { MoodRing } from '@/components/duo/mood-ring';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { cardGap, space } from '@/constants/tokens';

type Side = {
  name: string;
  /** Person colour — rose for you, iris for them. Never swapped. */
  color: string;
  moodColor: string;
  moodLabel: string;
  needLabel: string;
  battery: number;
};

type Props = {
  you: Side;
  partner: Side;
  /** Your card is tappable (opens check-in); theirs is read-only. */
  onPressYou?: () => void;
};

/**
 * The app's signature component: two equal cards, 12px gap, one per person.
 *
 * This is how users read the split-duo layout at a glance, so the person→colour
 * mapping is fixed by the caller and never varies per screen.
 */
export function DuoStateCard({ you, partner, onPressYou }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: cardGap }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Your check-in. ${you.moodLabel}, ${you.battery} percent. Tap to update.`}
        onPress={onPressYou}
        style={{ flex: 1 }}
      >
        <PersonCard side={you} interactive />
      </Pressable>
      <View style={{ flex: 1 }}>
        <PersonCard side={partner} />
      </View>
    </View>
  );
}

function PersonCard({ side, interactive }: { side: Side; interactive?: boolean }) {
  const theme = useTheme();

  return (
    <Card style={{ flex: 1, gap: space.sm, alignItems: 'flex-start' }}>
      <Text role="overline" color={side.color}>
        {side.name}
      </Text>
      <MoodRing color={side.moodColor} battery={side.battery} />
      <View style={{ gap: 2 }}>
        <Text role="cardTitle">{side.moodLabel}</Text>
        <Text role="caption" color={theme.color.textSecondary}>
          {side.needLabel}
        </Text>
      </View>
      {interactive ? (
        <Text role="overline" color={theme.color.textTertiary}>
          Tap to update
        </Text>
      ) : null}
    </Card>
  );
}
