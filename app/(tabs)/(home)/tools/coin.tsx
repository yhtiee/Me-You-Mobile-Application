import * as Haptics from 'expo-haptics';
import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GameIntro } from '@/components/play/game-intro';
import { ResultReveal } from '@/components/play/result-reveal';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useCoinGame } from '@/hooks/use-play';
import { curve, gradients, motion, palette, radius, space } from '@/constants/tokens';

const SIZE = 176;

/**
 * Argument settler (PRD Module 2), as a turn-based session.
 *
 * What changed from the flat version, and why it had to:
 *
 * The outcome used to be `Math.random()` on the device. Two phones rolling
 * separately is two different answers to one argument, with nothing to
 * reconcile them — for a game whose entire premise is "we will both accept
 * what this says", that is the whole thing broken. The result now comes from
 * `flip_coin_session`, so both phones read one row.
 *
 * There was also no notion of a turn, so "who flips" was whoever tapped first.
 * The server assigns it by alternating from the last flip, which is a rule
 * either partner can check.
 *
 * The spin still starts on the frame of the tap; it just does not know what it
 * is landing on until a beat later. See `onFlip`.
 */
export default function CoinTool() {
  const theme = useTheme();
  const {
    you,
    partner,
    session,
    isYourTurn,
    settled,
    flip,
    endSession,
    history,
    tally,
    error,
    refetch,
  } = useCoinGame();

  // Every line on this screen names them. One fallback here beats six, and the
  // coin has to be flippable before the profiles have loaded.
  const partnerName = partner?.name ?? 'Your partner';

  const [stake, setStake] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [revision, setRevision] = useState(0);

  const angle = useSharedValue(0);

  /*
   * The reveal is driven by the session, not by local state, so the partner —
   * who tapped nothing — gets the same reveal the flipper does the moment the
   * realtime update lands. `revision` bumps on a genuinely new result so the
   * reveal animation replays rather than sitting there already finished.
   */
  const settledKey = session?.resultUserId ? `${session.id}:${session.resultUserId}` : null;
  const seenRef = useRef<string | null>(null);
  useEffect(() => {
    if (settledKey && settledKey !== seenRef.current) setRevision((n) => n + 1);
    seenRef.current = settledKey;
  }, [settledKey]);

  const stopSpin = useCallback(() => {
    setSpinning(false);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  /**
   * Spin first, land second.
   *
   * The outcome comes from the server now, so it is not known at the moment of
   * the tap. Waiting for it before moving anything would put a visible dead
   * beat between the press and the coin. Instead the coin starts an
   * indeterminate spin on the same frame, and the result — when it arrives —
   * retargets the animation onto the right face from wherever it has got to.
   */
  const onFlip = async () => {
    if (spinning || !isYourTurn) return;

    setSpinning(true);
    // Linear, because this stretch is filler. Any easing here would read as the
    // coin slowing onto a face it has not been given yet.
    angle.value = withTiming(angle.value + 720, { duration: 700, easing: Easing.linear });

    const winner = await flip();

    if (!winner) {
      setSpinning(false);
      return;
    }

    // Land on the winner's face from wherever we are, always turning forwards.
    const from = angle.value;
    const face = winner === 'you' ? 0 : 180;
    const delta = (((face - (from % 360)) % 360) + 360) % 360;

    angle.value = withTiming(
      from + 1080 + delta,
      { duration: motion.coin.ms, easing: Easing.bezier(...curve.coin) },
      (finished) => {
        if (finished) runOnJS(stopSpin)();
      }
    );
  };

  /**
   * Ask before leaving.
   *
   * A session stays open until someone closes it, and an abandoned one blocks
   * the next argument — the database allows exactly one open per couple. So
   * leaving is the moment to ask, rather than hoping somebody remembers to come
   * back and tidy up.
   *
   * Only asks once there is a result: a session nobody flipped is not a
   * decision anyone made, so it is left for whoever opens the screen next
   * instead of being turned into a question.
   */
  const navigation = useNavigation();
  const endRef = useRef(endSession);
  useEffect(() => {
    endRef.current = endSession;
  }, [endSession]);

  const hasResult = settled !== null;
  useEffect(() => {
    if (!hasResult) return;

    return navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();

      Alert.alert(
        'Settled?',
        'Closing this passes the turn over, and the next thing you flip for starts fresh.',
        [
          {
            text: 'Leave it open',
            style: 'cancel',
            onPress: () => navigation.dispatch(event.data.action),
          },
          {
            text: 'Close it',
            onPress: () => {
              void endRef.current(null);
              navigation.dispatch(event.data.action);
            },
          },
        ]
      );
    });
  }, [navigation, hasResult]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${angle.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${angle.value + 180}deg` }],
  }));

  // The typed stake wins while you are typing; the session's is what the other
  // person named it. Either way the reveal quotes one sentence, not two.
  const sessionStake = (stake.trim() || session?.stake || '').trim();
  const winnerName = settled === 'you' ? 'You' : partnerName;

  return (
    <Screen gap={space.xl}>
      <GameIntro game="coin" />

      {/* Non-blocking. A failed read costs the tally at the bottom; the coin
          above it still works, so this must not take the place of the game the
          way a full-screen error state would. */}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      <TurnBanner isYourTurn={isYourTurn} partnerName={partnerName} settled={hasResult} />

      <TextField
        label="What are we settling?"
        placeholder="Who takes the bins out…"
        value={stake || session?.stake || ''}
        onChangeText={setStake}
        returnKeyType="done"
        // Renaming the argument after the coin has answered it is rewriting
        // history, and both phones are looking at the same row.
        editable={!hasResult}
      />

      <View style={{ height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[faceStyle, { experimental_backgroundImage: gradients.coin }, frontStyle]}
        >
          <Text role="display" color="#fff" style={{ fontSize: 30 }} numberOfLines={1}>
            {you.name}
          </Text>
        </Animated.View>
        <Animated.View style={[faceStyle, { backgroundColor: palette.brand.iris }, backStyle]}>
          <Text role="display" color="#fff" style={{ fontSize: 30 }} numberOfLines={1}>
            {partnerName}
          </Text>
        </Animated.View>
      </View>

      {hasResult && !spinning ? (
        <ResultReveal
          game="coin"
          revision={revision}
          kicker={sessionStake || 'The coin says'}
          result={`${winnerName} goes first`}
          note={
            settled === 'you'
              ? 'Being the bigger person costs nothing and buys a lot.'
              : `${partnerName} is up. Let them know.`
          }
        />
      ) : (
        <Text role="caption" center color={theme.color.textTertiary}>
          {spinning
            ? 'Spinning…'
            : isYourTurn === false
              ? `${partnerName} has this one.`
              : 'Tap below when you’re both ready.'}
        </Text>
      )}

      {/*
       * One button, and which job it has depends on the session rather than on
       * anything this screen remembers. After a result it closes the session —
       * which is also what passes the turn — so a pair who just settled
       * something can go straight into the next thing.
       */}
      {hasResult ? (
        <Button
          label="Settle something else"
          full
          onPress={() => {
            void endSession(stake.trim() || null);
            setStake('');
          }}
        />
      ) : (
        <Button
          label={isYourTurn === false ? `Waiting for ${partnerName}` : 'Flip the coin'}
          full
          disabled={spinning || !isYourTurn}
          onPress={() => void onFlip()}
        />
      )}

      {tally.total > 0 ? (
        <View style={{ gap: space.md }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Last {tally.total}
          </Text>

          {/*
           * A row of dots, newest on the left. A bar chart of two numbers is a
           * chart in the pejorative sense; the dots answer "has it been fair?"
           * at a glance, which is the only question this data can support.
           */}
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            {history.slice(0, 5).map((entry) => (
              <View
                key={entry.id}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: radius.pill,
                  backgroundColor:
                    entry.winner === 'you' ? theme.person.you : theme.person.partner,
                }}
              />
            ))}
            <Text role="caption" color={theme.color.textSecondary} style={{ marginLeft: space.sm }}>
              {tally.you === tally.partner
                ? 'Dead even so far.'
                : tally.you > tally.partner
                  ? `You’ve gone first ${tally.you} of ${tally.total}.`
                  : `${partnerName} has gone first ${tally.partner} of ${tally.total}.`}
            </Text>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * Whose turn it is, stated before the coin rather than discovered by tapping.
 *
 * The alternative — a disabled button — tells you that you cannot do something
 * without telling you why, and "why" here is a rule the app invented and owes
 * an explanation for.
 *
 * Renders nothing once there is a result: at that point the turn is spent and
 * the reveal below is the thing to read.
 */
function TurnBanner({
  isYourTurn,
  partnerName,
  settled,
}: {
  isYourTurn: boolean | null;
  partnerName: string;
  settled: boolean;
}) {
  const theme = useTheme();

  // Null while the session is still loading — better to show nothing than to
  // claim it is your turn and take it back a frame later.
  if (settled || isYourTurn === null) return null;

  const tint = isYourTurn ? theme.tint.rose : theme.tint.iris;

  return (
    <View
      style={{
        gap: space.xs,
        padding: space.md,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: tint.bg,
      }}
    >
      <Text role="overline" color={tint.fg}>
        {isYourTurn ? 'Your flip' : 'Their flip'}
      </Text>
      <Text role="caption" color={tint.muted}>
        {isYourTurn
          ? 'It alternates, so this one is on you.'
          : `${partnerName} flipped last time — this one is theirs.`}
      </Text>
    </View>
  );
}

const faceStyle = {
  position: 'absolute',
  width: SIZE,
  height: SIZE,
  borderRadius: SIZE / 2,
  alignItems: 'center',
  justifyContent: 'center',
  backfaceVisibility: 'hidden',
  paddingHorizontal: space.lg,
  boxShadow: '0 12px 28px rgba(240,84,111,0.30)',
} as const;
