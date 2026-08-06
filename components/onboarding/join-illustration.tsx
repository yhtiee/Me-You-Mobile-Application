import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { HEART, SPARKLE } from '@/components/ui/svg-shapes';
import { palette, radius } from '@/constants/tokens';

/**
 * Their phone, showing the six characters you are about to type in.
 *
 * Deliberately one device rather than two: the copy already says the code comes
 * from their screen, so a second phone would only restate it and halve the size
 * of both. The chips are the partner colour, matching the right-hand disc on
 * the pair screen, so "theirs" stays the same colour across the flow.
 */

/** Screen box, in viewBox units. Chips are laid out against these. */
const SCREEN = { x: 128, y: 42, width: 64, height: 94 };

/** Six characters, as two rows of three. */
const CHIP = { width: 16, height: 20, gap: 5 };

const CHIP_ROW_X = (() => {
  const row = CHIP.width * 3 + CHIP.gap * 2;
  const start = SCREEN.x + (SCREEN.width - row) / 2;
  return [0, 1, 2].map((i) => start + i * (CHIP.width + CHIP.gap));
})();

/**
 * `height` accepts `"100%"` so the art can be handed a flexible box and grow
 * into it. The viewBox keeps the aspect ratio, so a taller box scales the
 * drawing up until the width runs out rather than stretching it.
 */
export function JoinIllustration({ height = 150 }: { height?: number | string }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 320 170" fill="none">
      {/* Grounding shadow, so the phone sits rather than floats. */}
      <Ellipse cx="160" cy="152" rx="88" ry="12" fill={palette.brand.roseSoft} opacity={0.55} />

      {/* Phone body. */}
      <Rect
        x="120"
        y="22"
        width="80"
        height="124"
        rx={radius.lg}
        fill={palette.light.surface}
        stroke={palette.light.border}
        strokeWidth={2}
      />
      <Rect x="148" y="30" width="24" height="5" rx="2.5" fill={palette.light.border} />

      {/* Screen. */}
      <Rect
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.width}
        height={SCREEN.height}
        rx="12"
        fill={palette.brand.irisSoft}
      />

      {/* The code itself — filled chips rather than glyphs, so nothing here
          depends on a font being available inside an SVG. */}
      {[62, 88].map((rowY) =>
        CHIP_ROW_X.map((x) => (
          <Rect
            key={`${rowY}-${x}`}
            x={x}
            y={rowY}
            width={CHIP.width}
            height={CHIP.height}
            rx="5"
            fill={palette.person.partner}
            opacity={0.85}
          />
        ))
      )}

      {/* Notification badge, tucked onto the phone's shoulder. */}
      <Circle cx="204" cy="46" r="18" fill={palette.brand.roseSoft} />
      <G transform="translate(193.2, 35.2) scale(0.9)">
        <Path d={HEART} fill={palette.brand.rose} />
      </G>

      {/* Two sparkles, off-axis so the composition is not perfectly mirrored. */}
      <G transform="translate(102, 58)">
        <Path d={SPARKLE} fill={palette.brand.amber} />
      </G>
      <G transform="translate(214, 122) scale(0.7)">
        <Path d={SPARKLE} fill={palette.brand.amber} />
      </G>
    </Svg>
  );
}
