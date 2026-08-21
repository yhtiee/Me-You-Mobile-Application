import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useCalendar } from '@/hooks/use-calendar';
import { useTheme } from '@/components/providers/theme-provider';
import { REMINDER_PRESETS } from '@/lib/calendar';
import { palette, radius, space } from '@/constants/tokens';
import { todayIso } from '@/utils/date';
import type { CalendarEvent } from '@/types/domain';

const KINDS: { key: CalendarEvent['kind']; label: string; annual: boolean; timed: boolean }[] = [
  { key: 'anniversary', label: 'Anniversary', annual: true, timed: false },
  { key: 'birthday', label: 'Birthday', annual: true, timed: false },
  { key: 'first-date', label: 'First date', annual: true, timed: false },
  { key: 'proposal', label: 'Proposal', annual: true, timed: false },
  { key: 'date-night', label: 'Date night', annual: false, timed: true },
  { key: 'custom', label: 'Something else', annual: false, timed: true },
];

/**
 * Add an event, its reminders, and whether it comes round again.
 *
 * Three things this screen could not do before. It wrote to the mock store, so
 * nothing it created survived a reload; it asked for the date as typed
 * `YYYY-MM-DD` text; and it had no way to say "this is every year", which meant
 * every birthday added through it went stale the day after it passed.
 */
export default function AddEvent() {
  const theme = useTheme();
  const { add } = useCalendar();

  /** The day tapped in the grid, so "+ Add" on the 14th opens on the 14th. */
  const params = useLocalSearchParams<{ date?: string }>();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => params.date ?? todayIso());
  const [time, setTime] = useState<string | null>(null);
  const [kind, setKind] = useState<CalendarEvent['kind']>('date-night');
  const [recurs, setRecurs] = useState(false);
  const [leads, setLeads] = useState<number[]>([1440]);
  const [saving, setSaving] = useState(false);

  const spec = KINDS.find((k) => k.key === kind);
  const takesTime = spec?.timed ?? true;
  const valid = title.trim().length > 0 && date.length > 0 && !saving;

  const presets = REMINDER_PRESETS.filter((p) => !p.timedOnly || (takesTime && time));

  const chooseKind = (next: CalendarEvent['kind']) => {
    const nextSpec = KINDS.find((k) => k.key === next);
    setKind(next);
    // A birthday has no 7:30pm, and it does repeat — so picking a kind sets the
    // two switches to what that kind almost always means, while leaving both
    // free to change.
    if (!nextSpec?.timed) setTime(null);
    setRecurs(nextSpec?.annual ?? false);
  };

  return (
    <Screen gap={space.xl}>
      <Card style={{ gap: space.lg }}>
        <TextField
          label="What is it"
          placeholder="Her birthday, our anniversary…"
          value={title}
          onChangeText={setTitle}
        />
        <DateField
          label="When"
          value={date}
          onChange={setDate}
          time={takesTime ? time : undefined}
          onChangeTime={takesTime ? setTime : undefined}
        />
      </Card>

      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Type
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {KINDS.map((k) => {
            const active = k.key === kind;
            return (
              <Pressable
                key={k.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => chooseKind(k.key)}
                style={{
                  paddingHorizontal: space.lg - 2,
                  paddingVertical: space.sm + 1,
                  borderRadius: radius.pill,
                  backgroundColor: active ? palette.brand.roseSoft : theme.color.surface,
                  borderWidth: 1,
                  borderColor: active ? palette.brand.roseSoft : theme.color.border,
                }}
              >
                <Text
                  role="caption"
                  color={active ? palette.brand.rosePressed : theme.color.textSecondary}
                >
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card style={{ gap: space.md }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: recurs }}
          accessibilityLabel="Repeats every year"
          onPress={() => setRecurs((v) => !v)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.sm - 2,
              borderWidth: 2,
              borderColor: recurs ? palette.brand.rose : theme.color.border,
              backgroundColor: recurs ? palette.brand.rose : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {recurs ? (
              <Text role="caption" color="#fff" style={{ fontSize: 13 }}>
                ✓
              </Text>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text role="bodyStrong">Every year</Text>
            <Text role="caption" color={theme.color.textSecondary}>
              {recurs
                ? 'It’ll roll forward on its own — no re-adding it next year.'
                : 'A one-off. It drops out of the list once it’s been.'}
            </Text>
          </View>
        </Pressable>
      </Card>

      <Card style={{ gap: space.md }}>
        <View style={{ gap: space.xs }}>
          <Text role="cardTitle">Remind us</Text>
          <Text role="caption" color={theme.color.textSecondary}>
            Both your phones get the nudge. You can change these later.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {presets.map((preset) => {
            const on = leads.includes(preset.minutes);
            return (
              <Pressable
                key={preset.minutes}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={preset.label}
                onPress={() =>
                  setLeads((list) =>
                    on ? list.filter((m) => m !== preset.minutes) : [...list, preset.minutes]
                  )
                }
                style={({ pressed }) => ({
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  borderRadius: radius.pill,
                  backgroundColor: on ? theme.tint.amber.bg : theme.color.surfaceSunken,
                  borderWidth: 1.5,
                  borderColor: on ? theme.brand.amber : 'transparent',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text role="caption" color={on ? theme.tint.amber.fg : theme.color.textSecondary}>
                  {on ? `✓ ${preset.label}` : preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Button
        label={saving ? 'Adding…' : 'Add to calendar'}
        full
        disabled={!valid}
        onPress={() => {
          setSaving(true);
          void add({
            title: title.trim(),
            date,
            time: takesTime ? time : null,
            kind,
            recursAnnually: recurs,
            reminderLeads: leads,
          }).then((ok) => {
            setSaving(false);
            // Only leaves on success — the hook has already toasted the reason,
            // and popping back would strand the user's typing.
            if (ok) router.back();
          });
        }}
      />
    </Screen>
  );
}
