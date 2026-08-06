import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AdSlot } from '@/components/ui/ad-slot';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useCalendar } from '@/hooks/use-calendar';
import { useTheme } from '@/components/providers/theme-provider';
import { countdownLabel } from '@/utils/date';
import { palette, radius, space } from '@/constants/tokens';

const KIND_GLYPH: Record<string, string> = {
  anniversary: '💞',
  birthday: '🎂',
  'first-date': '✨',
  proposal: '💍',
  'date-night': '🍷',
  custom: '📌',
};

/** Relationship calendar & countdowns (PRD Module 3). */
export default function Calendar() {
  const theme = useTheme();
  const { events, next } = useCalendar();

  return (
    <Screen gap={space.md}>
      {next ? (
        <Card style={{ gap: space.sm, backgroundColor: palette.brand.roseSoft }}>
          <Text role="overline" color={palette.brand.rosePressed}>
            Next up
          </Text>
          <Text role="title2" color="#7A2436">
            {next.title}
          </Text>
          <Text role="body" color={palette.brand.rosePressed}>
            {next.dateLabel} · {countdownLabel(next.daysAway)}
          </Text>
        </Card>
      ) : (
        <EmptyState label="+ Add your first date" onPress={() => router.push('/add-event')} />
      )}

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Everything coming
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/add-event')} hitSlop={8}>
            <Text role="caption" color={palette.brand.rose}>
              + Add
            </Text>
          </Pressable>
        </View>

        <Card style={{ gap: space.lg }}>
          {events.map((event) => (
            <View
              key={event.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: radius.md - 2,
                  borderCurve: 'continuous',
                  backgroundColor: theme.color.surfaceSunken,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 19 }}>{KIND_GLYPH[event.kind] ?? '📌'}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text role="bodyStrong">{event.title}</Text>
                <Text role="caption" color={theme.color.textSecondary}>
                  {event.dateLabel}
                </Text>
              </View>
              <Text
                role="caption"
                tabular
                color={event.daysAway <= 7 ? palette.brand.rose : theme.color.textTertiary}
              >
                {countdownLabel(event.daysAway)}
              </Text>
            </View>
          ))}
        </Card>
      </View>

      <Text role="caption" color={theme.color.textTertiary}>
        We’ll nudge you 7 days, 3 days and 1 day before each one.
      </Text>

      <AdSlot />
    </Screen>
  );
}
