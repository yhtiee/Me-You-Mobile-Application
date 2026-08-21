import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { GameIntro } from '@/components/play/game-intro';
import { ResultReveal } from '@/components/play/result-reveal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { CloseIcon } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useWheelGame } from '@/hooks/use-play';
import { curve, fontFamily, motion, radius, space, wheelFills } from '@/constants/tokens';

const SIZE = 280;
const R = SIZE / 2;

/** Darkened Play accents — see `wheelFills` for why these are not the accents. */
const FILLS = wheelFills;

/**
 * Whose Turn Wheel (PRD Module 2) — customisable, so segment maths must never
 * assume a fixed count. Decide-then-animate, like the coin.
 *
 * The wedges are labelled. That sounds obvious and it was the single biggest
 * problem with the old screen: it drew six unlabelled colour slices and then
 * printed a legend underneath, so watching the wheel told you nothing and you
 * had to read a key to find out what you'd won. A wheel whose faces you cannot
 * read is a loading spinner.
 */
export default function WheelTool() {
  const theme = useTheme();
  const { options, add, remove, recordSpin, loading, error, refetch } = useWheelGame();

  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [revision, setRevision] = useState(0);

  const angle = useSharedValue(0);
  /** Which wedge was under the pointer at the last haptic tick. */
  const lastWedge = useSharedValue(-1);

  const canSpin = options.length >= 2;
  const seg = options.length > 0 ? 360 / options.length : 360;

  const tick = () => {
    // Light, not medium: this fires up to ~25 times across a spin, and anything
    // heavier stops reading as a wheel catching and starts reading as an error.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  /**
   * A click each time a new wedge passes the pointer.
   *
   * Derived from the rotation itself rather than scheduled on a timer, so the
   * ticks slow down exactly as the wheel does — which is the entire physical
   * cue that it is coming to rest. A timer would keep an even rhythm and the
   * spin would feel like a progress bar.
   */
  useAnimatedReaction(
    () => angle.value,
    (current) => {
      if (!spinning) return;
      const wedge = Math.floor((((-current % 360) + 360) % 360) / seg);
      if (wedge !== lastWedge.value) {
        lastWedge.value = wedge;
        if (process.env.EXPO_OS === 'ios') runOnJS(tick)();
      }
    },
    [spinning, seg]
  );

  const settle = (label: string) => {
    setSpinning(false);
    setResult(label);
    setRevision((n) => n + 1);
    recordSpin(label);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const spin = () => {
    if (spinning || !canSpin) return;
    const idx = Math.floor(Math.random() * options.length);
    const spins = 4 + Math.floor(Math.random() * 2);

    // The pointer sits at 12 o'clock, so rotate the winning segment's centre up.
    const target = spins * 360 - (idx * seg + seg / 2);

    setSpinning(true);
    setResult(null);
    lastWedge.value = -1;
    angle.value = withTiming(
      angle.value + target - (angle.value % 360),
      { duration: motion.wheel.ms, easing: Easing.bezier(...curve.wheel) },
      (finished) => {
        if (finished) runOnJS(settle)(options[idx].label);
      }
    );
  };

  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  if (error) {
    return (
      <Screen gap={space.xl}>
        <GameIntro game="wheel" />
        <ErrorState message={error} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen gap={space.xl}>
      <GameIntro game="wheel" />

      <View style={{ alignItems: 'center', gap: space.md }}>
        {/* Pointer. Drawn over the wheel, dipping into it, so it reads as
            touching the rim rather than floating above it. */}
        <View
          style={{
            width: 0,
            height: 0,
            marginBottom: -10,
            borderLeftWidth: 11,
            borderRightWidth: 11,
            borderTopWidth: 18,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: theme.color.textPrimary,
            zIndex: 1,
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={canSpin ? 'Spin the wheel' : 'Add at least two options to spin'}
          accessibilityState={{ disabled: !canSpin || spinning }}
          disabled={!canSpin || spinning}
          onPress={spin}
        >
          <Animated.View style={wheelStyle}>
            <Svg width={SIZE} height={SIZE}>
              <G>
                {options.map((option, i) => (
                  <Path
                    key={option.id}
                    d={arcPath(R, i * seg, (i + 1) * seg)}
                    fill={FILLS[i % FILLS.length]}
                    stroke={theme.color.surface}
                    strokeWidth={2}
                  />
                ))}

                {options.map((option, i) => {
                  const mid = i * seg + seg / 2;
                  // Text is laid out horizontally at the wheel's centre, then
                  // rotated out along its own wedge — which is why the anchor is
                  // `start` with an x offset rather than a centred label placed
                  // by trigonometry.
                  return (
                    <SvgText
                      key={`label-${option.id}`}
                      x={R}
                      y={R}
                      fill="#fff"
                      fontSize={13}
                      fontFamily={fontFamily.body.bold}
                      textAnchor="start"
                      alignmentBaseline="middle"
                      transform={`rotate(${mid - 90} ${R} ${R}) translate(${R * 0.28} 0)`}
                    >
                      {truncate(option.label, labelBudget(options.length))}
                    </SvgText>
                  );
                })}

                <Circle cx={R} cy={R} r={30} fill={theme.color.surface} />
                <Circle
                  cx={R}
                  cy={R}
                  r={30}
                  fill="none"
                  stroke={theme.color.border}
                  strokeWidth={2}
                />
              </G>
            </Svg>
          </Animated.View>
        </Pressable>

        <Text role="caption" color={theme.color.textTertiary}>
          {spinning ? 'Round and round…' : canSpin ? 'Tap the wheel, or the button.' : ' '}
        </Text>
      </View>

      {result ? (
        <ResultReveal
          game="wheel"
          revision={revision}
          kicker="The wheel says"
          result={result}
          note="No appeals, no re-spins. That was the deal."
        />
      ) : null}

      <Button
        label={result ? 'Spin again' : 'Spin the wheel'}
        full
        disabled={spinning || !canSpin}
        onPress={spin}
      />

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text role="cardTitle">On the wheel</Text>
          <Text role="caption" tabular color={theme.color.textTertiary}>
            {options.length}
          </Text>
        </View>

        {loading ? (
          <View style={{ gap: space.md }}>
            <Skeleton height={18} />
            <Skeleton height={18} width="70%" />
          </View>
        ) : options.length === 0 ? (
          <Text role="body" color={theme.color.textSecondary}>
            Empty. Add the two things you keep going back and forth on.
          </Text>
        ) : null}

        {options.map((option, i) => (
          <View
            key={option.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: radius.pill,
                backgroundColor: FILLS[i % FILLS.length],
              }}
            />
            <Text role="body" style={{ flex: 1 }} numberOfLines={1}>
              {option.label}
            </Text>
            {/*
             * An icon target, not the word "Remove" in red. Four rows each
             * ending in red text made the list look like a column of errors,
             * and the 48px target is what the tokens require anyway.
             */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${option.label}`}
              hitSlop={space.sm}
              onPress={() => remove(option)}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.color.surfaceSunken,
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <CloseIcon color={theme.color.textSecondary} />
            </Pressable>
          </View>
        ))}

        <TextField
          placeholder="Add an option…"
          value={draft}
          onChangeText={setDraft}
          returnKeyType="done"
          onSubmitEditing={() => {
            void add(draft).then((ok) => { if (ok) setDraft(''); });
          }}
        />
      </Card>
    </Screen>
  );
}

/**
 * How many characters fit on a wedge before it overruns the rim.
 *
 * Falls with the wedge count, because a label runs radially: four options give
 * each label a 90° wedge and plenty of room, twelve give it 30° and the text
 * spills over its neighbours long before it reaches the edge.
 */
function labelBudget(count: number): number {
  if (count <= 4) return 18;
  if (count <= 6) return 14;
  if (count <= 8) return 11;
  return 9;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
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
