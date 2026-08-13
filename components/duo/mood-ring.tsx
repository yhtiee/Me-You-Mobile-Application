import { ArcGauge } from '@/components/ui/arc-gauge';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';

type Props = {
  /** Mood colour drives the ring; battery % sits in the middle. */
  color: string;
  /** Null before that person has checked in today. */
  battery: number | null;
  size?: number;
};

/**
 * 58px ring, 5px stroke in the mood colour, battery % centred.
 *
 * The ring is a gauge, not a border: the stroke's length *is* the battery, so a
 * 20% day and a 90% day are told apart across the room, before the number is
 * read.
 *
 * The empty ring is the same ring, not a smaller or absent one: the two duo
 * cards must stay the same height whether one, both or neither person has
 * checked in, or the card that *does* have data grows and looks like the
 * important one.
 */
export function MoodRing({ color, battery, size = 58 }: Props) {
  const theme = useTheme();
  const empty = battery === null;

  return (
    <ArcGauge
      value={(battery ?? 0) / 100}
      size={size}
      color={color}
      empty={empty}
      trackColor={empty ? theme.color.border : undefined}
    >
      {empty ? (
        <Text
          role="title3"
          color={theme.color.textTertiary}
          accessibilityLabel="No check-in yet"
        >
          –
        </Text>
      ) : (
        <Text role="cardTitle" tabular color={theme.color.textPrimary}>
          {battery}
          <Text role="overline" color={theme.color.textTertiary}>
            %
          </Text>
        </Text>
      )}
    </ArcGauge>
  );
}
