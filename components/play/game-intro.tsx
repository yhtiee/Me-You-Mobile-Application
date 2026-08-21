import { View } from 'react-native';

import { Glyph } from '@/components/ui/glyph';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { radius, space } from '@/constants/tokens';
import { PLAY_BY_KEY } from '@/constants/play';
import type { PlayGameKey } from '@/constants/tokens';

type Props = {
  game: PlayGameKey;
  /**
   * Overrides the catalogue title. Only for screens whose heading is a question
   * the catalogue name would answer badly — the trivia tile says "How well do
   * you know them", the screen asks it.
   */
  title?: string;
  /** Right-hand slot: a score, a counter, a round indicator. */
  trailing?: React.ReactNode;
};

/**
 * The banner every game screen opens with.
 *
 * Each of the five tool screens used to hand-roll `<Text role="title2">` over
 * `<Text role="body">`, which meant the game you tapped in the grid — a
 * saturated coloured tile — opened onto plain black-on-wash text with no
 * connection to it. Carrying the tile's own tint across the navigation is the
 * whole point: the colour is the continuity.
 */
export function GameIntro({ game, title, trailing }: Props) {
  const theme = useTheme();
  const tint = theme.play[game];
  const spec = PLAY_BY_KEY[game];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.lg,
        padding: space.lg,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: tint.bg,
      }}
    >
      <Glyph size={32}>{spec.glyph}</Glyph>

      <View style={{ flex: 1, gap: space.xs }}>
        <Text role="title3" color={tint.fg}>
          {title ?? spec.title}
        </Text>
        <Text role="caption" color={tint.muted}>
          {spec.blurb}
        </Text>
      </View>

      {trailing}
    </View>
  );
}

/**
 * A number with a word under it, on a game's tint. The trailing slot above.
 *
 * Tabular figures are load-bearing — these sit next to a live count that
 * changes as you play, and proportional digits make the label jump sideways
 * every time a 1 becomes a 2.
 */
export function GameScore({ game, value, label }: { game: PlayGameKey; value: string; label: string }) {
  const theme = useTheme();
  const tint = theme.play[game];

  return (
    <View style={{ alignItems: 'center', minWidth: 52 }}>
      <Text role="title2" tabular color={tint.fg}>
        {value}
      </Text>
      <Text role="overline" color={tint.muted}>
        {label}
      </Text>
    </View>
  );
}
