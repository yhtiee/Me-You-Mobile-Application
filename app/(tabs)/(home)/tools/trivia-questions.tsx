import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useOwnTriviaQuestions, usePlayPeople } from '@/hooks/use-play';
import { layout, radius, space } from '@/constants/tokens';

/** Four is the shape of the stock bank, and the most a phone row fits legibly. */
const SLOTS = 4;

/**
 * Write the questions your partner will be asked about you.
 *
 * About *you*, which is the part that makes the game work and the part this
 * screen has to be explicit about. A question is only scorable if the person
 * who set the right answer is the person the answer is about — otherwise a
 * "wrong" answer from your partner is really you being wrong about them, marked
 * against them. The database enforces it (`subject_user_id = auth.uid()` in
 * 0021); the copy here exists so nobody has to discover the rule by hitting it.
 *
 * The couple's own questions take priority in a round and the stock bank only
 * fills a shortfall, so this screen is how a couple stops playing the app's
 * generic questions and starts playing their own.
 */
export default function TriviaQuestions() {
  const theme = useTheme();
  const { partner } = usePlayPeople();
  const { questions, add, remove, loading, error, refetch } = useOwnTriviaQuestions();

  const partnerName = partner?.name ?? 'your partner';

  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<string[]>(Array(SLOTS).fill(''));
  const [correct, setCorrect] = useState(0);
  const [saving, setSaving] = useState(false);

  const setOption = (index: number, value: string) =>
    setOptions((current) => current.map((o, i) => (i === index ? value : o)));

  const filled = options.map((o) => o.trim()).filter(Boolean);
  // Two is the database's own floor (`trivia_options_length`), and it is also
  // the point below which there is nothing to guess.
  const correctIsFilled = options[correct]?.trim().length > 0;
  const valid = prompt.trim().length > 2 && filled.length >= 2 && correctIsFilled;

  const reset = () => {
    setPrompt('');
    setOptions(Array(SLOTS).fill(''));
    setCorrect(0);
  };

  const onSave = async () => {
    if (!valid || saving) return;
    setSaving(true);

    /*
     * Blank slots are dropped before saving, which moves the right answer.
     *
     * `correct` indexes the four on-screen inputs; the row stores an index into
     * the options actually saved. Leaving a gap in the middle would otherwise
     * point `correct_index` at the wrong string — and the check constraint
     * would not catch it, because the number is still in range.
     */
    const kept = options.map((o) => o.trim());
    const answer = kept.slice(0, correct + 1).filter(Boolean).length - 1;

    const ok = await add(prompt, kept.filter(Boolean), Math.max(0, answer));
    setSaving(false);
    if (ok) reset();
  };

  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.xs }}>
        <Text role="title3">Questions about you</Text>
        <Text role="body" color={theme.color.textSecondary}>
          {partnerName} gets asked these — you set the right answer, because
          you’re the one who knows it. Write a few and they’ll replace the app’s
          generic ones.
        </Text>
      </View>

      <Card style={{ gap: space.lg }}>
        <TextField
          label="Your question"
          placeholder="What do I order every single time?"
          value={prompt}
          onChangeText={setPrompt}
          maxLength={140}
        />

        <View style={{ gap: space.sm }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Answers — tap the circle to mark the right one
          </Text>

          {options.map((option, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: correct === index }}
                accessibilityLabel={`Mark answer ${index + 1} as correct`}
                onPress={() => setCorrect(index)}
                hitSlop={8}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: radius.pill,
                  borderWidth: correct === index ? 0 : 1.5,
                  borderColor: theme.color.border,
                  backgroundColor:
                    correct === index ? theme.color.success : theme.color.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {correct === index ? (
                  <Text role="caption" color="#FFFFFF">
                    ✓
                  </Text>
                ) : null}
              </Pressable>

              <View style={{ flex: 1 }}>
                <TextField
                  placeholder={index < 2 ? `Answer ${index + 1}` : 'Optional'}
                  value={option}
                  onChangeText={(value) => setOption(index, value)}
                  maxLength={60}
                />
              </View>
            </View>
          ))}
        </View>

        <Button
          label={saving ? 'Saving…' : 'Add question'}
          full
          disabled={!valid || saving}
          onPress={() => void onSave()}
        />

        {!valid && prompt.trim().length > 0 ? (
          <Text role="caption" color={theme.color.textTertiary}>
            Needs a question, at least two answers, and the right one filled in.
          </Text>
        ) : null}
      </Card>

      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      <View style={{ gap: space.md }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Yours ({questions.length})
        </Text>

        {loading ? (
          <Card style={{ gap: space.md }}>
            <Skeleton width="72%" height={14} />
            <Skeleton width="46%" height={11} />
          </Card>
        ) : questions.length === 0 ? (
          <EmptyState label="Nothing yet — the app’s questions will stand in until you write one." />
        ) : (
          questions.map((item) => (
            <Card key={item.id} style={{ gap: space.sm }}>
              <Text role="bodyStrong">{item.question}</Text>
              <Text role="caption" color={theme.color.textSecondary}>
                {/* The right answer, spelled out. This list is only ever seen by
                    the person it is about, so there is nothing to hide here —
                    and a list of questions without their answers would be
                    impossible to check for mistakes. */}
                Right answer: {item.options[item.correctIndex] ?? '—'}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete: ${item.question}`}
                onPress={() => void remove(item.id)}
                hitSlop={6}
                style={{ minHeight: layout.minTarget - 16, justifyContent: 'center' }}
              >
                <Text role="caption" color={theme.color.danger}>
                  Delete
                </Text>
              </Pressable>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
