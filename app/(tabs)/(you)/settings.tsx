import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { TogetherEditor } from '@/components/home/together-editor';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, space } from '@/constants/tokens';

/** Settings & account management (PRD §5). */
export default function Settings() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const { isPremium } = usePremium();
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [partnerAlerts, setPartnerAlerts] = useState(true);
  const [countdownAlerts, setCountdownAlerts] = useState(true);

  return (
    <Screen gap={space.xl}>
      {/* First, because it is the one thing on this screen that changes what
          Home looks like — and because until it is set the banner reads "Just
          getting started" for everyone. */}
      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Your hub
        </Text>
        <TogetherEditor />
      </View>

      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Subscription
        </Text>
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <ListRow label="Plan" value={isPremium ? 'Premium · $1/mo' : 'Free'} />
          <ListRow
            label={isPremium ? 'Manage billing' : 'Upgrade to Premium'}
            onPress={() => router.push('/paywall')}
          />
          <ListRow label="Restore purchases" onPress={() => {}} last />
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Notifications
        </Text>
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <ListRow
            label="Streak warnings"
            sublabel="Before midnight, if one of you hasn’t checked in"
            right={
              <Switch
                value={streakAlerts}
                onValueChange={setStreakAlerts}
                trackColor={{ true: palette.brand.rose }}
              />
            }
          />
          <ListRow
            label="Partner check-ins"
            right={
              <Switch
                value={partnerAlerts}
                onValueChange={setPartnerAlerts}
                trackColor={{ true: palette.brand.rose }}
              />
            }
          />
          <ListRow
            label="Countdowns"
            sublabel="7, 3 and 1 day before"
            last
            right={
              <Switch
                value={countdownAlerts}
                onValueChange={setCountdownAlerts}
                trackColor={{ true: palette.brand.rose }}
              />
            }
          />
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Privacy
        </Text>
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <ListRow label="Your reminders and notes" value="Encrypted" />
          <ListRow label="Offline data" value="Wiki + calendar" />
          <ListRow label="Privacy policy" onPress={() => {}} last />
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Danger zone
        </Text>
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <ListRow label="Unpair from partner" destructive onPress={() => router.push('/unpair')} />
          <ListRow label="Log out" destructive onPress={signOut} last />
        </Card>
      </View>
    </Screen>
  );
}
