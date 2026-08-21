import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { kindColor } from '@/components/calendar/month-grid';
import { Glyph } from '@/components/ui/glyph';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { REMINDER_PRESETS } from '@/lib/calendar';
import { layout, radius, space } from '@/constants/tokens';
import { anniversaryCount, formatTimeLabel } from '@/utils/date';
import type { DatedEvent } from '@/hooks/use-calendar';

export const KIND_GLYPH: Record<string, string> = {
  anniversary: '💞',
  birthday: '🎂',
  'first-date': '✨',
  proposal: '💍',
  'date-night': '🍷',
  custom: '📌',
};

type Props = {
  event: DatedEvent;
  onToggleReminder: (event: DatedEvent, leadMinutes: number) => void;
  onDelete: (event: DatedEvent) => void;
  /** Hides the countdown where the surrounding heading already gives the day. */
  showCountdown?: boolean;
};

/**
 * One event, expandable into its reminders.
 *
 * Reminders live here rather than only on an edit screen because that is where
 * the thought occurs — you see "Sarah's birthday, in 6 days" and want a nudge
 * the day before. Making that a two-tap navigation to a form is how a feature
 * that exists goes unused.
 */
export function EventRow({ event, onToggleReminder, onDelete, showCountdown = true }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const accent = kindColor(event.kind, theme);
  const reminderCount = event.reminders?.length ?? 0;
  const years = anniversaryCount(event.date, event.recursAnnually ?? false);

  // "2 hours before" is meaningless on an all-day event.
  const presets = REMINDER_PRESETS.filter((p) => !p.timedOnly || event.time);

  return (
    <View style={{ gap: space.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${event.title}. ${
          event.time ? formatTimeLabel(event.time) : 'All day'
        }. ${reminderCount} ${reminderCount === 1 ? 'reminder' : 'reminders'}. Tap for reminders.`}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: layout.minTarget,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        {/* A colour bar rather than a tinted square: it reads as the same
            language as the grid dots above, which use the same hue per kind. */}
        <View
          style={{
            width: 4,
            alignSelf: 'stretch',
            minHeight: 40,
            borderRadius: radius.pill,
            backgroundColor: accent,
          }}
        />

        <Glyph size={20}>{KIND_GLYPH[event.kind] ?? '📌'}</Glyph>

        <View style={{ flex: 1, gap: 2 }}>
          <Text role="bodyStrong" numberOfLines={2}>
            {event.title}
          </Text>
          <Text role="caption" color={theme.color.textSecondary}>
            {[
              event.time ? formatTimeLabel(event.time) : 'All day',
              // "3rd year" only where it means something — a birthday the app
              // has never seen before has no count to give.
              years ? `${ordinal(years)} year` : null,
              showCountdown ? event.countdown : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {reminderCount > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: space.sm,
              paddingVertical: 3,
              borderRadius: radius.pill,
              backgroundColor: theme.tint.amber.bg,
            }}
          >
            <Glyph size={10}>🔔</Glyph>
            <Text role="caption" tabular color={theme.tint.amber.fg}>
              {reminderCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {open ? (
        <View
          style={{
            gap: space.md,
            padding: space.md,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: theme.color.surfaceSunken,
          }}
        >
          <Text role="overline" color={theme.color.textTertiary}>
            Remind us
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {presets.map((preset) => {
              const on = (event.reminders ?? []).some((r) => r.leadMinutes === preset.minutes);
              return (
                <Pressable
                  key={preset.minutes}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={preset.label}
                  onPress={() => onToggleReminder(event, preset.minutes)}
                  style={({ pressed }) => ({
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.pill,
                    backgroundColor: on ? theme.tint.amber.bg : theme.color.surface,
                    borderWidth: 1.5,
                    borderColor: on ? theme.brand.amber : theme.color.border,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text
                    role="caption"
                    color={on ? theme.tint.amber.fg : theme.color.textSecondary}
                  >
                    {on ? `✓ ${preset.label}` : preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${event.title}`}
            hitSlop={space.sm}
            onPress={() => onDelete(event)}
            style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}
          >
            <Text role="caption" color={theme.color.danger}>
              Remove this event
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
