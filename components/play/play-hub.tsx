import { View } from 'react-native';

import { GameTile } from '@/components/play/game-tile';
import { PlayActivityFeed } from '@/components/play/play-activity';
import { PlayHero } from '@/components/play/play-hero';
import { AdSlot } from '@/components/ui/ad-slot';
import { ErrorState } from '@/components/ui/error-state';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { usePlayHub, usePlayPeople } from '@/hooks/use-play';
import { cardGap, space } from '@/constants/tokens';
import type { PlayGame } from '@/constants/play';

/**
 * PRD Module 2, "Play & Settle" — the hub.
 *
 * Two groups, not one list, and the grouping is by *how long it takes* rather
 * than by what kind of thing it is. That is the question a couple is actually
 * answering when they open this screen: "we're stuck on something, decide it"
 * and "we have an evening, entertain us" are different needs, and the old flat
 * list of five cards put a two-second coin flip and a multi-round trivia game
 * on identical rows.
 */
export function PlayHub() {
  const theme = useTheme();
  const { pick, kicker, stats, instant, session, error, refetch } = usePlayHub();
  const { partner } = usePlayPeople();

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <PlayHero game={pick} kicker={kicker} />

      <Section
        title="Settle it now"
        caption="One tap, and it’s decided. No one has to be the bad guy."
        games={instant}
        stats={stats}
        offset={0}
      />

      <Section
        title="Make an evening of it"
        caption="For when you’ve got more than a minute."
        games={session}
        stats={stats}
        offset={instant.length}
      />

      {/* Below the games rather than above them: the hub's job is to get you
          into one, and a history that pushed the tiles down would put the
          record of playing ahead of the playing. */}
      <PlayActivityFeed partnerName={partner?.name ?? 'Your partner'} />

      <Text role="caption" center color={theme.color.textTertiary}>
        Nothing here is kept score of. That’s the point.
      </Text>

      <AdSlot />
    </>
  );
}

type SectionProps = {
  title: string;
  caption: string;
  games: PlayGame[];
  stats: Record<string, string | undefined>;
  /**
   * Where this section starts in the overall grid, so the entrance stagger runs
   * once down the whole screen rather than restarting at each heading.
   */
  offset: number;
};

function Section({ title, caption, games, stats, offset }: SectionProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: space.md, marginTop: space.sm }}>
      <View style={{ gap: space.xs }}>
        <Text role="title3">{title}</Text>
        <Text role="caption" color={theme.color.textSecondary}>
          {caption}
        </Text>
      </View>

      {/*
       * Hand-paired rows rather than `flexWrap`. Wrapping gives every tile its
       * natural height, so a two-line title on one tile leaves its neighbour
       * short and the grid goes ragged. Rows of two with `flex: 1` on each tile
       * make both children of a row share the tallest height, which is the only
       * way a grid of mixed-length titles stays a grid.
       */}
      {chunk(games, 2).map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: cardGap }}>
          {row.map((game, colIndex) => (
            <GameTile
              key={game.key}
              game={game}
              index={offset + rowIndex * 2 + colIndex}
              stat={stats[game.key]}
            />
          ))}
          {/* Keeps a lone tile in an odd-length row at half width instead of
              letting it stretch across and impersonate a section header. */}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
