import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EventRow } from '@/components/calendar/event-row';
import { MonthGrid } from '@/components/calendar/month-grid';
import { AdSlot } from '@/components/ui/ad-slot';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCalendar } from '@/hooks/use-calendar';
import { useTheme } from '@/components/providers/theme-provider';
import { formatDayLong, todayIso } from '@/utils/date';
import { gradients, radius, space } from '@/constants/tokens';

/** Relationship calendar & countdowns (PRD Module 3). */
export default function Calendar() {
  const theme = useTheme();
  const {
    upcoming,
    next,
    byDate,
    selected,
    setSelected,
    selectedEvents,
    loading,
    error,
    refetch,
    remove,
    toggleReminder,
  } = useCalendar();

  /** Which month the grid is showing. Follows selection, but can be paged past it. */
  const [month, setMonth] = useState(() => todayIso());

  const addOn = (date: string) => router.push({ pathname: '/add-event', params: { date } });

  if (error) {
    return (
      <Screen gap={space.md}>
        <ErrorState message={error} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen gap={space.lg}>
      {/*
       * "Next up" stays, and stays at the top. The grid answers "is the 14th
       * free"; this answers the question people actually open the tab for.
       */}
      {loading ? (
        <Card style={{ gap: space.sm }}>
          <Skeleton height={12} width="30%" />
          <Skeleton height={26} width="70%" />
          <Skeleton height={14} width="45%" />
        </Card>
      ) : next ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next up: ${next.title}, ${next.countdown}`}
          onPress={() => {
            setSelected(next.occursOn);
            setMonth(next.occursOn);
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
        >
          <View
            style={{
              experimental_backgroundImage: gradients.duo,
              borderRadius: radius.xl,
              borderCurve: 'continuous',
              padding: space.xl,
              gap: space.xs,
            }}
          >
            <Text role="overline" color="rgba(255,255,255,0.82)">
              Next up
            </Text>
            <Text role="title2" color="#fff" numberOfLines={2}>
              {next.title}
            </Text>
            <Text role="body" color="rgba(255,255,255,0.92)">
              {next.dateLabel} · {next.countdown}
            </Text>
          </View>
        </Pressable>
      ) : (
        <EmptyState label="+ Add your first date" onPress={() => addOn(selected)} />
      )}

      <Card style={{ gap: space.lg }}>
        <MonthGrid
          month={month}
          onChangeMonth={setMonth}
          selected={selected}
          onSelect={setSelected}
          byDate={byDate}
        />

        <View style={{ height: 1, backgroundColor: theme.color.border }} />

        <View style={{ gap: space.md }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text role="cardTitle">
              {selected === todayIso() ? 'Today' : formatDayLong(selected)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add something on ${formatDayLong(selected)}`}
              hitSlop={space.sm}
              onPress={() => addOn(selected)}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text role="caption" color={theme.brand.rose}>
                + Add
              </Text>
            </Pressable>
          </View>

          {selectedEvents.length === 0 ? (
            <Text role="body" color={theme.color.textSecondary}>
              Nothing planned. Which is also a plan.
            </Text>
          ) : (
            selectedEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                showCountdown={false}
                onToggleReminder={toggleReminder}
                onDelete={(e) => void remove(e.id)}
              />
            ))
          )}
        </View>
      </Card>

      <View style={{ gap: space.md }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Everything coming
        </Text>

        {loading ? (
          <Card style={{ gap: space.lg }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={40} round={radius.sm} />
            ))}
          </Card>
        ) : upcoming.length === 0 ? (
          <EmptyState label="+ Add something to look forward to" onPress={() => addOn(selected)} />
        ) : (
          <Card style={{ gap: space.xl }}>
            {upcoming.slice(0, 8).map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onToggleReminder={toggleReminder}
                onDelete={(e) => void remove(e.id)}
              />
            ))}
          </Card>
        )}
      </View>

      <Text role="caption" center color={theme.color.textTertiary}>
        Tap an event to set a reminder. Both your phones get it.
      </Text>

      <AdSlot />
    </Screen>
  );
}
