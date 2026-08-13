import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/components/providers/theme-provider';

type Props = {
  /** 0-1. Clamped. */
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  /** Track colour. Defaults to `color` at `trackOpacity`, which keeps it in key. */
  trackColor?: string;
  trackOpacity?: number;
  /** Disc behind the arc, which is what the centre content sits on. */
  fill?: string;
  /** Draws the track only — for "no data yet", as opposed to a value of zero. */
  empty?: boolean;
  children?: ReactNode;
};

/**
 * A circular progress arc with something in the middle.
 *
 * The one place the app does arc maths. Two components need it — the mood
 * ring's battery and the Us screen's relationship health — and getting the
 * dash offset or the start angle subtly different between them would show up as
 * two gauges that fill in opposite directions.
 */
export function ArcGauge({
  value,
  size = 58,
  stroke = 5,
  color,
  trackColor,
  trackOpacity = 0.2,
  fill,
  empty,
  children,
}: Props) {
  const theme = useTheme();

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, value));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? color}
          strokeOpacity={trackColor ? 1 : trackOpacity}
          strokeWidth={stroke}
          fill={fill ?? theme.color.surface}
        />
        {empty ? null : (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - filled)}
            /*
             * Starts the arc at twelve o'clock. SVG's zero is three o'clock,
             * which puts a low value in an arbitrary-looking place. Set with the
             * element props rather than a `transform` string — those are parsed
             * by react-native-svg itself and do not depend on how a given
             * version tokenises SVG transform syntax.
             */
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        )}
      </Svg>

      {children}
    </View>
  );
}
