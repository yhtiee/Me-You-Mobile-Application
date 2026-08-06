import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { HEART, SPARKLE } from '@/components/ui/svg-shapes';
import { palette } from '@/constants/tokens';

/**
 * "Two of you, one hub" — two person marks either side of a shared card.
 *
 * Drawn rather than supplied as a PNG. The other onboarding art is raster
 * because it is painted illustration; this is two discs, a card and a heart, so
 * as vector it stays crisp at any size, weighs a couple of kilobytes against
 * ~250KB, and — the reason that matters here — reads its colours from
 * `palette`, so the rose and iris stay locked to the values the rest of the
 * screen uses instead of being baked into pixels.
 *
 * The discs are the person colours in the same left-you / right-partner order
 * as the couple banner, so the mapping still holds once you are inside the app.
 */

/** Head-and-shoulders inside a coloured disc, clipped to it. */
function Person({ cx, color, clipId }: { cx: number; color: string; clipId: string }) {
  return (
    <>
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={cx} cy="92" r="30" />
        </ClipPath>
      </Defs>

      {/* Clipping is load-bearing, not decoration: the shoulder arc is wider
          than the disc at the height it meets it, so unclipped its corners
          hang out past the edge. */}
      <G clipPath={`url(#${clipId})`}>
        <Circle cx={cx} cy="92" r="30" fill={color} />
        <Circle cx={cx} cy="83" r="10" fill={palette.light.surface} opacity={0.92} />
        <Path
          d={`M${cx - 24} 130a24 24 0 0 1 48 0`}
          fill={palette.light.surface}
          opacity={0.92}
        />
      </G>

      {/* Ring drawn after, so the clip never eats into it. */}
      <Circle
        cx={cx}
        cy="92"
        r="30"
        fill="none"
        stroke={palette.light.surface}
        strokeWidth={5}
      />
    </>
  );
}

export function PairIllustration({ height = 150 }: { height?: number }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 320 170" fill="none">
      {/* Grounding shadow, so the group sits rather than floats. */}
      <Ellipse cx="160" cy="146" rx="104" ry="13" fill={palette.brand.roseSoft} opacity={0.55} />

      {/* Dashed run between each person and the hub — the link being made. */}
      <Path
        d="M92 92h20"
        stroke={palette.light.textTertiary}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <Path
        d="M208 92h20"
        stroke={palette.light.textTertiary}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />

      <Person cx={58} color={palette.person.you} clipId="pairYou" />
      <Person cx={262} color={palette.person.partner} clipId="pairPartner" />

      {/* The hub itself. */}
      <Rect
        x="112"
        y="50"
        width="96"
        height="84"
        rx="26"
        fill={palette.light.surface}
        stroke={palette.light.border}
        strokeWidth={2}
      />
      <G transform="translate(136, 68) scale(2)">
        <Path d={HEART} fill={palette.brand.rose} />
      </G>

      {/* Two sparkles, off-axis so the composition is not perfectly mirrored. */}
      <G transform="translate(106, 40)">
        <Path d={SPARKLE} fill={palette.brand.amber} />
      </G>
      <G transform="translate(220, 128) scale(0.7)">
        <Path d={SPARKLE} fill={palette.brand.amber} />
      </G>
    </Svg>
  );
}
