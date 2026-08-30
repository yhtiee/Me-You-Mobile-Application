import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCoach } from '@/hooks/use-coach';
import { useTheme } from '@/components/providers/theme-provider';
import { countdownLabel, daysUntil } from '@/utils/date';
import { radius, space } from '@/constants/tokens';

/**
 * Past conversations.
 *
 * Selection travels back to the chat screen as a route param rather than
 * through shared state. `useCoach` is a hook, so this route holds its own
 * instance of it — calling `openConversation` here would open a thread in a
 * screen nobody is looking at. Navigating with the id lets the chat screen do
 * it, which is also what makes the back gesture land somewhere coherent.
 */
export default function CoachHistory() {
  const theme = useTheme();
  const { conversations, conversationsLoading, archive } = useCoach();

  const open = (id: string) => {
    router.navigate({ pathname: '/(tabs)/(coach)', params: { conversationId: id } });
  };

  const confirmArchive = (id: string, title: string) => {
    Alert.alert('Remove this conversation?', `“${title}” will disappear from your list.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void archive(id) },
    ]);
  };

  return (
    <Screen gap={space.md}>
      <Text role="body" color={theme.color.textSecondary}>
        Only you can see these. Your partner never can.
      </Text>

      {conversationsLoading ? (
        <Card style={{ gap: space.lg }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={38} round={radius.sm} />
          ))}
        </Card>
      ) : conversations.length === 0 ? (
        <EmptyState label="Nothing yet — go and ask something" onPress={() => router.back()} />
      ) : (
        <Card style={{ gap: space.lg }}>
          {conversations.map((conversation) => (
            <View
              key={conversation.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${conversation.title}`}
                onPress={() => open(conversation.id)}
                style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed ? 0.6 : 1 })}
              >
                <Text role="bodyStrong" numberOfLines={1}>
                  {conversation.title}
                </Text>
                <Text role="caption" color={theme.color.textSecondary}>
                  {countdownLabel(daysUntil(conversation.lastMessageAt.slice(0, 10)))}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${conversation.title}`}
                hitSlop={space.sm}
                onPress={() => confirmArchive(conversation.id, conversation.title)}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Text role="caption" color={theme.color.danger}>
                  Remove
                </Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
