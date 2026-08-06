import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AdSlot } from '@/components/ui/ad-slot';
import { Card } from '@/components/ui/card';
import { CheckboxRow } from '@/components/ui/checkbox-row';
import { CoupleBanner } from '@/components/home/couple-banner';
import { DuoStateCard } from '@/components/duo/duo-state-card';
import { QuickActions } from '@/components/home/quick-actions';
import { Text } from '@/components/ui/text';
import { useCheckin } from '@/hooks/use-checkin';
import { useCouple } from '@/components/providers/couple-provider';
import { useRelationship } from '@/hooks/use-relationship';
import { useStreak } from '@/hooks/use-streak';
import { useTheme } from '@/components/providers/theme-provider';
import { useTodos } from '@/hooks/use-todos';
import { palette, space } from '@/constants/tokens';

/**
 * The daily hub, and now the whole of Home: banner, quick actions, streak, both
 * moods, the nudge. Private to-dos moved to their own screen behind the
 * to-do quick action.
 */
export function TodaySegment() {
  const theme = useTheme();
  const { you, partner } = useCheckin();
  const { count } = useStreak();
  const { togetherLabel } = useRelationship();
  const { checkedOnThem, toggleCheckedOnThem, partnerName } = useTodos();
  const couple = useCouple();

  return (
    <>
      <CoupleBanner
        youName={couple.you.name}
        partnerName={couple.partner.name}
        youAvatar={couple.you.avatarUri}
        partnerAvatar={couple.partner.avatarUri}
        togetherLabel={togetherLabel}
        streak={count}
        onPressStreak={() => router.push('/streak')}
      />

      <QuickActions />

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          How you’re both doing
        </Text>
        <DuoStateCard
          you={{ ...you, name: 'You' }}
          partner={partner}
          onPressYou={() => router.push('/checkin')}
        />
      </View>

      {/* Partner's dynamic status line, verbatim from the PRD example. */}
      <Card accent={palette.brand.irisSoft} style={{ gap: space.xs }}>
        <Text role="overline" color={palette.person.partner}>
          Right now
        </Text>
        <Text role="bodyStrong">
          {partner.name} feels {partner.battery}% loved — {partner.needLabel.toLowerCase()}.
        </Text>
      </Card>

      <Card style={{ gap: space.md }}>
        <CheckboxRow
          label={`Yes, I've checked up on ${partnerName} today`}
          checked={checkedOnThem}
          onToggle={toggleCheckedOnThem}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/handoff')}
          hitSlop={6}
        >
          <Text role="caption" color={palette.brand.rose}>
            Not yet — open a chat ›
          </Text>
        </Pressable>
      </Card>

      <AdSlot />
    </>
  );
}

/** Kept here so the deep-link intent is documented next to its only caller. */
export async function openChatWith(scheme: string, fallback: string) {
  const canOpen = await Linking.canOpenURL(scheme);
  await Linking.openURL(canOpen ? scheme : fallback);
}
