import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { useRelationship } from '@/hooks/use-relationship';
import { useTheme } from '@/components/providers/theme-provider';
import { useWiki } from '@/hooks/use-wiki';
import { cardGap, palette, space } from '@/constants/tokens';
import type { LoveLanguage } from '@/types/domain';

/** Love languages, shared goals, bucket list, wiki entry point, health bar. */
export function UsSegment() {
  const theme = useTheme();
  const { you, partner, goals, goalsDone, toggleGoal, bucketList, health } = useRelationship();
  const { partnerName, filledCount, entries } = useWiki();

  return (
    <>
      {/* DESIGN GAP — PRD P2 "Relationship Health Bar"; no mock design exists.
          First pass below, composition documented in use-relationship.ts. */}
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text role="cardTitle">Relationship health</Text>
          <Text role="title3" tabular color={palette.brand.rose}>
            {health}%
          </Text>
        </View>
        <ProgressBar value={health / 100} color={palette.brand.rose} />
        <Text role="caption" color={theme.color.textSecondary}>
          Built from your streak, check-ins you both completed, and dates you actually logged.
        </Text>
      </Card>

      <Pressable accessibilityRole="button" onPress={() => router.push('/wiki')}>
        <Card accent={palette.brand.irisSoft} style={{ gap: space.sm, backgroundColor: palette.brand.irisSoft }}>
          <Text role="overline" color={palette.person.partner}>
            Partner wiki
          </Text>
          <Text role="cardTitle" color="#3F3161">
            {filledCount} of {entries.length} things you know about {partnerName}
          </Text>
          <Text role="caption" color="#6B5C8E">
            Ring size, the flowers, the dream trip — kept offline too. ›
          </Text>
        </Card>
      </Pressable>

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Shared goals · {goalsDone} done
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/add-goal')} hitSlop={8}>
            <Text role="caption" color={palette.brand.rose}>
              + Add
            </Text>
          </Pressable>
        </View>

        <Card style={{ gap: space.lg }}>
          {goals.length === 0 ? (
            <EmptyState label="+ Set your first goal" onPress={() => router.push('/add-goal')} />
          ) : (
            goals.map((goal) => (
              <Pressable
                key={goal.id}
                accessibilityRole="button"
                accessibilityLabel={`${goal.label}, ${goal.current} of ${goal.target}`}
                onPress={() => toggleGoal(goal.id)}
                style={{ gap: space.sm }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                  <Text
                    role="bodyStrong"
                    style={{ flex: 1 }}
                    color={goal.done ? theme.color.textTertiary : theme.color.textPrimary}
                  >
                    {goal.label}
                  </Text>
                  <Text
                    role="caption"
                    tabular
                    color={goal.done ? theme.color.success : theme.color.textSecondary}
                  >
                    {goal.done ? 'Done' : `${goal.current}/${goal.target}`}
                  </Text>
                </View>
                <ProgressBar
                  value={goal.done ? 1 : goal.current / goal.target}
                  color={goal.done ? theme.color.success : palette.brand.amber}
                  height={6}
                />
              </Pressable>
            ))
          )}
        </Card>
      </View>

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Love languages
        </Text>
        <View style={{ flexDirection: 'row', gap: cardGap }}>
          <LanguageCard name="You" color={palette.person.you} items={you.loveLanguages} />
          <LanguageCard name={partner.name} color={palette.person.partner} items={partner.loveLanguages} />
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/bucket-list')}>
        <Card style={{ gap: space.xs }}>
          <Text role="cardTitle">Bucket list</Text>
          <Text role="caption" color={theme.color.textSecondary}>
            {bucketList.filter((b) => b.done).length} of {bucketList.length} ticked off ›
          </Text>
        </Card>
      </Pressable>
    </>
  );
}

function LanguageCard({
  name,
  color,
  items,
}: {
  name: string;
  color: string;
  items: LoveLanguage[];
}) {
  const theme = useTheme();

  return (
    <Card style={{ flex: 1, gap: space.md }}>
      <Text role="overline" color={color}>
        {name}
      </Text>
      {items.slice(0, 3).map((item) => (
        <View key={item.key} style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text role="caption" style={{ flex: 1 }} color={theme.color.textSecondary} numberOfLines={1}>
              {item.label}
            </Text>
            <Text role="caption" tabular color={theme.color.textTertiary}>
              {item.value}%
            </Text>
          </View>
          {/* Health/love-language bars use the owning person's colour. */}
          <ProgressBar value={item.value / 100} color={color} height={6} />
        </View>
      ))}
    </Card>
  );
}
