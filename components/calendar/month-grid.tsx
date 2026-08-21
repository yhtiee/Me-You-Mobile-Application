import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { layout, radius, space } from '@/constants/tokens';
import {
  WEEKDAY_INITIALS,
  formatMonthYear,
  isSameMonth,
  monthGrid,
  parseIsoDate,
  todayIso,
} from '@/utils/date';
import type { DatedEvent } from '@/hooks/use-calendar';

type Props = {
  /** Any date inside the month being shown. */
  month: string;
  onChangeMonth: (month: string) => void;
  selected: string;
  onSelect: (iso: string) => void;
  byDate: Map<string, DatedEvent[]>;
};

const DOT = 5;

/**
 * The month, as a month.
 *
 * The calendar tab had no grid at all — it was a "next up" card over a flat
 * list, which answers "what is soon" and nothing else. A relationship calendar
 * is also asked "is the 14th free?" and "what did we do in June?", and neither
 * is answerable from a list.
 *
 * The grid is always six rows tall even when five would do. A month that
 * changes height as you page through the year makes everything below it jump,
 * and the row that appears and disappears is the one the thumb is already
 * moving toward.
 */
export function MonthGrid({ month, onChangeMonth, selected, onSelect, byDate }: Props) {
  const theme = useTheme();
  const weeks = monthGrid(month);
  const today = todayIso();

  const step = (offset: number) => {
    const d = parseIsoDate(month);
    onChangeMonth(todayIso(new Date(d.getFullYear(), d.getMonth() + offset, 1)));
    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text role="title3" style={{ flex: 1 }}>
          {formatMonthYear(month)}
        </Text>

        {!isSameMonth(today, month) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            hitSlop={space.sm}
            onPress={() => {
              onChangeMonth(today);
              onSelect(today);
            }}
            style={({ pressed }) => ({
              paddingHorizontal: space.md,
              paddingVertical: space.xs,
              borderRadius: radius.pill,
              backgroundColor: theme.tint.rose.bg,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text role="caption" color={theme.tint.rose.fg}>
              Today
            </Text>
          </Pressable>
        ) : null}

        <Arrow label="Previous month" glyph="‹" onPress={() => step(-1)} />
        <Arrow label="Next month" glyph="›" onPress={() => step(1)} />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_INITIALS.map((initial, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text role="overline" color={theme.color.textTertiary}>
              {initial}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ gap: space.xs }}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((iso) => (
              <Day
                key={iso}
                iso={iso}
                inMonth={isSameMonth(iso, month)}
                isToday={iso === today}
                isSelected={iso === selected}
                events={byDate.get(iso) ?? []}
                onPress={() => {
                  onSelect(iso);
                  // Tapping a trailing or leading day pages to its month, so the
                  // selection never sits on a square the grid stops showing.
                  if (!isSameMonth(iso, month)) onChangeMonth(iso);
                  if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Arrow({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.sm}
      onPress={onPress}
      style={({ pressed }) => ({
        width: layout.headerCircle,
        height: layout.headerCircle,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.surfaceSunken,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Text role="title3" color={theme.color.textSecondary}>
        {glyph}
      </Text>
    </Pressable>
  );
}

type DayProps = {
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: DatedEvent[];
  onPress: () => void;
};

function Day({ iso, inMonth, isToday, isSelected, events, onPress }: DayProps) {
  const theme = useTheme();
  const day = Number(iso.slice(8, 10));

  /*
   * Selection is a filled circle, today is a ring, and a day can be both.
   * Using one treatment for both states means the day you tapped and the day it
   * actually is become indistinguishable the moment they differ — which is most
   * of the time.
   */
  const fill = isSelected ? theme.brand.rose : 'transparent';
  const ink = isSelected
    ? '#fff'
    : !inMonth
      ? theme.color.textTertiary
      : isToday
        ? theme.brand.rose
        : theme.color.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={dayLabel(iso, events.length)}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fill,
          borderWidth: isToday && !isSelected ? 1.5 : 0,
          borderColor: theme.brand.rose,
          // Out-of-month days stay tappable but recede, so the month you are
          // looking at reads as a block rather than as a 42-day soup.
          opacity: inMonth ? 1 : 0.45,
        }}
      >
        <Text role="bodyStrong" tabular color={ink}>
          {day}
        </Text>
      </View>

      {/* Up to three dots, then nothing — a row of eight dots under a date is
          noise, and the day view below has the detail. */}
      <View style={{ flexDirection: 'row', gap: 3, height: DOT + 2, marginTop: 1 }}>
        {events.slice(0, 3).map((event) => (
          <View
            key={event.id}
            style={{
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              backgroundColor: isSelected ? theme.brand.rose : kindColor(event.kind, theme),
              opacity: inMonth ? 1 : 0.5,
            }}
          />
        ))}
      </View>
    </Pressable>
  );
}

/**
 * Dot colour per kind. Birthdays and anniversaries are the two a couple scans
 * for, so they get the two person colours; everything else is amber.
 */
export function kindColor(kind: DatedEvent['kind'], theme: ReturnType<typeof useTheme>): string {
  switch (kind) {
    case 'birthday':
      return theme.brand.amber;
    case 'anniversary':
    case 'first-date':
    case 'proposal':
      return theme.person.partner;
    case 'date-night':
      return theme.person.you;
    default:
      return theme.color.textTertiary;
  }
}

function dayLabel(iso: string, count: number): string {
  const long = parseIsoDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  if (count === 0) return `${long}, nothing planned`;
  return `${long}, ${count} ${count === 1 ? 'event' : 'events'}`;
}
