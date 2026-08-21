import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { layout, radius, space } from '@/constants/tokens';
import { todayIso } from '@/utils/date';

type Props = {
  label?: string;
  /** ISO `YYYY-MM-DD`. Empty string means nothing chosen yet. */
  value: string;
  onChange: (iso: string) => void;
  /**
   * `HH:MM` (24h), or null for an all-day event. Omit both this and
   * `onChangeTime` to hide the time half entirely — a birthday has no 7:30pm.
   */
  time?: string | null;
  onChangeTime?: (time: string | null) => void;
  /** Blocks earlier dates. Pass `todayIso()` for "can't plan the past". */
  minimumDate?: string;
  hint?: string;
};

/**
 * A real date picker, in the platform's own calendar.
 *
 * Both screens that take a date used to avoid one. The calendar's Add Event
 * asked the user to type `YYYY-MM-DD` into a text box and validated it with a
 * regex; the date setter offered three chips — Tonight, Tomorrow, Weekend —
 * which covered the common case and made every other date in the year
 * unreachable, on a screen called "Date setter".
 *
 * The chips were not wrong, they were incomplete, so the date setter keeps them
 * as shortcuts above this field rather than instead of it.
 *
 * Platform split is deliberate and not cosmetic. Android's picker *is* a modal
 * dialog — the component renders nothing inline and must be mounted only while
 * open, then unmounted on the `set`/`dismissed` event, or it reopens itself on
 * the next render. iOS has no dialog: `display="inline"` draws a real calendar
 * in place, so it expands under the field. Trying to force one model onto both
 * is what produces a picker that reopens forever on Android or a floating
 * spinner with no dismiss affordance on iOS.
 */
export function DateField({
  label,
  value,
  onChange,
  time,
  onChangeTime,
  minimumDate,
  hint,
}: Props) {
  const theme = useTheme();
  const isIos = process.env.EXPO_OS === 'ios';

  const [openPart, setOpenPart] = useState<'date' | 'time' | null>(null);
  const showTime = onChangeTime != null;

  /*
   * Parsed as local noon, not midnight.
   *
   * `new Date('2026-08-23')` is parsed by spec as *UTC* midnight, which in any
   * timezone west of Greenwich is the 22nd locally — so the calendar would open
   * on the day before the one on screen. Noon is far enough from both edges
   * that no offset can push it across a day boundary.
   */
  const asDate = value ? new Date(`${value}T12:00:00`) : new Date();
  const minimum = minimumDate ? new Date(`${minimumDate}T00:00:00`) : undefined;

  const timeAsDate = (() => {
    const base = new Date(asDate);
    const [h, m] = (time ?? '19:00').split(':').map(Number);
    base.setHours(h ?? 19, m ?? 0, 0, 0);
    return base;
  })();

  const handleDate = (event: DateTimePickerEvent, picked?: Date) => {
    // Android reports dismissal through the event; iOS never does, and its
    // inline calendar stays open until the user collapses it themselves.
    if (!isIos) setOpenPart(null);
    if (event.type === 'dismissed' || !picked) return;
    onChange(toIsoDate(picked));
  };

  const handleTime = (event: DateTimePickerEvent, picked?: Date) => {
    if (!isIos) setOpenPart(null);
    if (event.type === 'dismissed' || !picked) return;
    onChangeTime?.(
      `${`${picked.getHours()}`.padStart(2, '0')}:${`${picked.getMinutes()}`.padStart(2, '0')}`
    );
  };

  return (
    <View style={{ gap: space.sm - 2 }}>
      {label ? (
        <Text role="overline" color={theme.color.textTertiary}>
          {label}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Slot
          flex={showTime ? 1.6 : 1}
          active={openPart === 'date'}
          placeholder="Pick a date"
          accessibilityLabel={value ? `Date: ${formatLong(value)}. Change` : 'Pick a date'}
          onPress={() => setOpenPart((p) => (p === 'date' ? null : 'date'))}
        >
          {value ? formatLong(value) : ''}
        </Slot>

        {showTime ? (
          <Slot
            flex={1}
            active={openPart === 'time'}
            placeholder="All day"
            accessibilityLabel={time ? `Time: ${formatTime(time)}. Change` : 'Add a time'}
            onPress={() => setOpenPart((p) => (p === 'time' ? null : 'time'))}
          >
            {time ? formatTime(time) : ''}
          </Slot>
        ) : null}
      </View>

      {/*
       * Clearing the time is its own affordance, because there is no way to
       * express "actually, all day" inside a time wheel — every value it can
       * return is a time.
       */}
      {showTime && time ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove the time, make it all day"
          hitSlop={space.sm}
          onPress={() => {
            onChangeTime?.(null);
            setOpenPart(null);
          }}
          style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}
        >
          <Text role="caption" color={theme.brand.rose}>
            Make it all day
          </Text>
        </Pressable>
      ) : null}

      {openPart === 'date' ? (
        <PickerHost>
          <DateTimePicker
            value={asDate}
            mode="date"
            display={isIos ? 'inline' : 'default'}
            minimumDate={minimum}
            onChange={handleDate}
            // Only affects the iOS inline calendar, which draws its own chrome
            // and otherwise inherits the system accent rather than the brand's.
            accentColor={theme.brand.rose}
            themeVariant={theme.scheme}
          />
        </PickerHost>
      ) : null}

      {openPart === 'time' ? (
        <PickerHost>
          <DateTimePicker
            value={timeAsDate}
            mode="time"
            display={isIos ? 'spinner' : 'default'}
            onChange={handleTime}
            accentColor={theme.brand.rose}
            themeVariant={theme.scheme}
          />
        </PickerHost>
      ) : null}

      {hint ? (
        <Text role="caption" color={theme.color.textSecondary}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Wrapper for the expanded picker.
 *
 * Renders nothing of its own on Android, where the picker is a dialog and a
 * container would reserve empty space in the layout behind it.
 */
function PickerHost({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  if (process.env.EXPO_OS !== 'ios') return <>{children}</>;

  return (
    <View
      style={{
        backgroundColor: theme.color.surfaceSunken,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
      }}
    >
      {children}
    </View>
  );
}

type SlotProps = {
  flex: number;
  active: boolean;
  placeholder: string;
  accessibilityLabel: string;
  onPress: () => void;
  children: string;
};

/** The tappable value, styled to match `TextField` so a form reads as one. */
function Slot({ flex, active, placeholder, accessibilityLabel, onPress, children }: SlotProps) {
  const theme = useTheme();
  const empty = children.length === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex,
        minHeight: layout.minTarget,
        justifyContent: 'center',
        paddingHorizontal: space.lg - 2,
        borderRadius: radius.sm,
        borderCurve: 'continuous',
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? theme.brand.rose : theme.color.border,
        backgroundColor: theme.color.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text role="bodyStrong" color={empty ? theme.color.textTertiary : theme.color.textPrimary}>
        {empty ? placeholder : children}
      </Text>
    </Pressable>
  );
}

/** Local-date ISO. Never `toISOString`, which converts to UTC first. */
function toIsoDate(d: Date): string {
  return todayIso(d);
}

/** "Sat, 23 Aug" — and the year too, once it stops being this one. */
function formatLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Rendered in the device's own 12/24-hour convention. */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
