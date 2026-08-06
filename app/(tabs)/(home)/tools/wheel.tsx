import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path, Circle } from 'react-native-svg';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useTools } from '@/hooks/use-tools';
import { curve, motion, palette, space } from '@/constants/tokens';

const SIZE = 260;
const R = SIZE / 2;

/** Segment fills cycle through the brand hues; no new colours invented. */
const FILLS = [
  palette.brand.rose,
  palette.brand.iris,
  palette.brand.amber,
  '#7E9BD4',
  '#3B7F5C',
  '#E4795F',
];

/**
 * Whose Turn Wheel (PRD Module 2) — customisable, so segment maths must never
 * assume a fixed count. Decide-then-animate, like the coin.
 */
export default function WheelTool() {
  const theme = useTheme();
  const { wheelOptions } = useTools();
  const [options, setOptions] = useState<string[]>(wheelOptions);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const angle = useSharedValue(0);

  const settle = (label: string) => {
    setSpinning(false);
    setResult(label);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const spin = () => {
    if (spinning || options.length < 2) return;
    const idx = Math.floor(Math.random() * options.length);
    const seg = 360 / options.length;
    const spins = 4 + Math.floor(Math.random() * 2);

    // The pointer sits at 12 o'clock, so rotate the winning segment's centre up.
    const target = spins * 360 - (idx * seg + seg / 2);

    setSpinning(true);
    setResult(null);
    angle.value = withTiming(
      angle.value + target - (angle.value % 360),
      { duration: motion.wheel.ms, easing: Easing.bezier(...curve.wheel) },
      (finished) => {
        if (finished) runOnJS(settle)(options[idx]);
      },
    );
  };

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const seg = 360 / options.length;

  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.sm }}>
        <Text role="title2">Whose turn is it?</Text>
        <Text role="body" color={theme.color.textSecondary}>
          Add whatever you keep bickering about. The wheel doesn’t take sides.
        </Text>
      </View>

      <View style={{ alignItems: 'center', gap: space.md }}>
        {/* Pointer */}
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 10,
            borderRightWidth: 10,
            borderTopWidth: 16,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: palette.light.textPrimary,
            zIndex: 1,
          }}
        />
        <Animated.View style={wheelStyle}>
          <Svg width={SIZE} height={SIZE}>
            <G>
              {options.map((option, i) => (
                <Path
                  key={`${option}-${i}`}
                  d={arcPath(R, i * seg, (i + 1) * seg)}
                  fill={FILLS[i % FILLS.length]}
                />
              ))}
              <Circle cx={R} cy={R} r={26} fill={theme.color.surface} />
            </G>
          </Svg>
        </Animated.View>
      </View>

      {result ? (
        <Card style={{ alignItems: 'center', gap: space.xs }}>
          <Text role="overline" color={theme.color.textTertiary}>
            The wheel says
          </Text>
          <Text role="title3" center>
            {result}
          </Text>
        </Card>
      ) : null}

      <Button
        label={result ? 'Spin again' : 'Spin the wheel'}
        full
        disabled={spinning || options.length < 2}
        onPress={spin}
      />

      <Card style={{ gap: space.md }}>
        <Text role="cardTitle">Options</Text>
        {options.map((option, i) => (
          <View
            key={`${option}-${i}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: FILLS[i % FILLS.length],
              }}
            />
            <Text role="body" style={{ flex: 1 }}>
              {option}
            </Text>
            <Text
              role="caption"
              color={theme.color.danger}
              onPress={() => setOptions((list) => list.filter((_, j) => j !== i))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${option}`}
            >
              Remove
            </Text>
          </View>
        ))}
        <TextField
          placeholder="Add an option…"
          value={draft}
          onChangeText={setDraft}
          returnKeyType="done"
          onSubmitEditing={() => {
            const value = draft.trim();
            if (!value) return;
            setOptions((list) => [...list, value]);
            setDraft('');
          }}
        />
      </Card>
    </Screen>
  );
}

/** SVG wedge from `start` to `end` degrees, measured from 12 o'clock. */
function arcPath(r: number, start: number, end: number) {
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [r + r * Math.cos(rad), r + r * Math.sin(rad)];
  };
  const [x1, y1] = toXY(start);
  const [x2, y2] = toXY(end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}
