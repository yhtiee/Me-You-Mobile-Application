import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { GameIntro } from '@/components/play/game-intro';
import { ResultReveal } from '@/components/play/result-reveal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useDatePlanner } from '@/hooks/use-play';
import { layout, radius, space } from '@/constants/tokens';
import { todayIso } from '@/utils/date';

/**
 * Date Setter (PRD Module 2), including the two named sub-features:
 * the Indecision Resolver and the guilt-free Raincheck.
 *
 * The old version wrote every event to `new Date()` — "add to calendar" always
 * meant *today*, whichever idea you picked, including the one labelled
 * "Sat 7:30 pm". The `when` chips below are the fix, and they are chips rather
 * than a date picker on purpose: a couple deciding to go out is choosing
 * between tonight, tomorrow and the weekend, and a calendar wheel makes them
 * do arithmetic to say so.
 */
export default function DateTool() {
  const theme = useTheme();
  const { ideas, addEvent } = useDatePlanner();

  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [resolved, setResolved] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [rainchecked, setRainchecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const whenOptions = useMemo(() => buildWhenOptions(), []);

  /**
   * The date itself is the state now, not which chip is lit.
   *
   * Holding a `WhenKey` and deriving the date from it was what made arbitrary
   * dates unrepresentable — there was no key for "the 14th". A chip is now just
   * a fast way to write a value that the picker can also write, and it lights
   * up when the date happens to equal the one it stands for.
   */
  const [date, setDate] = useState(() => whenOptions[1]?.iso ?? todayIso());
  const [time, setTime] = useState<string | null>(null);

  const choose = (id: string, ideaTitle: string, ideaLocation: string) => {
    setSelected(id);
    setTitle(ideaTitle);
    setLocation(ideaLocation);
    setSaved(false);
  };

  const resolve = () => {
    // Never hand back the idea already selected — "let us decide" returning the
    // thing you just tapped reads as the button being broken.
    const pool = ideas.filter((i) => i.id !== selected);
    const source = pool.length > 0 ? pool : ideas;
    const pick = source[Math.floor(Math.random() * source.length)];
    if (!pick) return;

    choose(pick.id, pick.title, pick.location ?? '');
    setResolved(pick.title);
    setRevision((n) => n + 1);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <Screen gap={space.xl}>
      <GameIntro game="date" />

      <View style={{ gap: space.sm }}>
        {ideas.map((idea) => {
          const active = idea.id === selected;
          return (
            <Pressable
              key={idea.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => choose(idea.id, idea.title, idea.location ?? '')}
            >
              <Card
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  // The tint, not a 1px accent border. A hairline in rose was
                  // the only signal of selection before, and on a white card at
                  // arm's length it is invisible.
                  backgroundColor: active ? theme.play.date.bg : theme.color.surface,
                }}
              >
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text role="cardTitle" color={active ? theme.play.date.fg : undefined}>
                    {idea.title}
                  </Text>
                  <Text
                    role="caption"
                    color={active ? theme.play.date.muted : theme.color.textSecondary}
                  >
                    {/* Both halves are nullable on stock rows, so this is a
                        join rather than a template — "· Sat 7:30 pm" with a
                        leading separator is the giveaway that a field is
                        missing rather than absent by design. */}
                    {[idea.location, idea.time].filter(Boolean).join(' · ') || 'Whenever suits'}
                  </Text>
                </View>

                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.pill,
                    borderWidth: 2,
                    borderColor: active ? theme.playAccent.date : theme.color.border,
                    backgroundColor: active ? theme.playAccent.date : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active ? (
                    <Text role="caption" color="#fff" style={{ fontSize: 13 }}>
                      ✓
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Button label="Can’t decide — pick for us" variant="secondary" full onPress={resolve} />

      {resolved ? (
        <ResultReveal
          game="date"
          revision={revision}
          kicker="Decided for you"
          result={resolved}
          note="Neither of you has to be the one who chose. Details are below."
        />
      ) : null}

      <Card style={{ gap: space.lg }}>
        <Text role="cardTitle">Details</Text>

        <TextField
          label="What"
          placeholder="Dinner, walk, that class…"
          value={title}
          onChangeText={(next) => {
            setTitle(next);
            setSaved(false);
          }}
        />
        <TextField
          label="Where"
          placeholder="Add a location"
          value={location}
          onChangeText={setLocation}
        />

        <View style={{ gap: space.sm }}>
          <Text role="overline" color={theme.color.textTertiary}>
            When
          </Text>

          {/*
           * Shortcuts, above a real picker rather than instead of one.
           *
           * These three cover most of what a couple planning an evening
           * actually picks, and tapping "Tomorrow" beats opening a calendar to
           * find it. But they used to be the *only* way to set a date, which
           * put every other day of the year out of reach on a screen called
           * "Date setter" — so they now just move the field below them.
           */}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {whenOptions.map((option) => {
              const active = option.iso === date;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${option.label}, ${option.hint}`}
                  onPress={() => {
                    setDate(option.iso);
                    setSaved(false);
                  }}
                  style={{
                    flex: 1,
                    minHeight: layout.minTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    borderRadius: radius.md,
                    borderCurve: 'continuous',
                    backgroundColor: active ? theme.play.date.bg : theme.color.surfaceSunken,
                    borderWidth: 1.5,
                    borderColor: active ? theme.playAccent.date : 'transparent',
                  }}
                >
                  <Text
                    role="bodyStrong"
                    color={active ? theme.play.date.fg : theme.color.textSecondary}
                  >
                    {option.label}
                  </Text>
                  <Text
                    role="caption"
                    color={active ? theme.play.date.muted : theme.color.textTertiary}
                  >
                    {option.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <DateField
            value={date}
            onChange={(next) => {
              setDate(next);
              setSaved(false);
            }}
            time={time}
            onChangeTime={(next) => {
              setTime(next);
              setSaved(false);
            }}
            // You cannot plan a date night for last Tuesday.
            minimumDate={todayIso()}
          />
        </View>

        <Button
          label={saving ? 'Adding…' : saved ? 'Added to your calendar' : 'Add to calendar'}
          full
          disabled={!title.trim() || !date || saved || saving}
          onPress={() => {
            /*
             * `saved` is set from the result, not from the press.
             *
             * The old version flipped it optimistically and never looked back,
             * so a failed insert still read "Added to your calendar" — the one
             * outcome someone would act on and be wrong about. The hook toasts
             * the reason; here the button simply goes back to being pressable.
             */
            setSaving(true);
            void addEvent({ title: title.trim(), date, time, kind: 'date-night' }).then((ok) => {
              setSaving(false);
              setSaved(ok);
              if (ok && process.env.EXPO_OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            });
          }}
        />
      </Card>

      <Card
        style={{
          gap: space.md,
          backgroundColor: rainchecked ? theme.tint.success.bg : theme.color.surface,
        }}
      >
        <Text role="cardTitle" color={rainchecked ? theme.tint.success.fg : undefined}>
          {rainchecked ? 'Rainchecked' : 'Plans fell through?'}
        </Text>
        <Text
          role="body"
          color={rainchecked ? theme.tint.success.muted : theme.color.textSecondary}
        >
          {rainchecked
            ? 'We’ll tell them gently — no pressure attached, and the streak is safe.'
            : 'Move it without it becoming a thing. No guilt, no streak damage.'}
        </Text>
        {!rainchecked ? (
          <Button label="Raincheck it" variant="neutral" full onPress={() => setRainchecked(true)} />
        ) : null}
      </Card>
    </Screen>
  );
}

/**
 * The three shortcut chips, resolved to real dates at render.
 *
 * "This weekend" means the coming Saturday — and on a Saturday it means today,
 * not next week, which is the edge case that makes a naive `+ (6 - day)` wrong
 * every seventh day.
 */
function buildWhenOptions(now = new Date()): { key: string; label: string; hint: string; iso: string }[] {
  const shift = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  const day = now.getDay();
  const untilSaturday = day === 6 ? 0 : (6 - day + 7) % 7;
  const weekend = shift(untilSaturday);
  const tomorrow = shift(1);

  const short = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return [
    { key: 'tonight', label: 'Tonight', hint: short(now), iso: todayIso(now) },
    { key: 'tomorrow', label: 'Tomorrow', hint: short(tomorrow), iso: todayIso(tomorrow) },
    { key: 'weekend', label: 'Weekend', hint: short(weekend), iso: todayIso(weekend) },
  ];
}
