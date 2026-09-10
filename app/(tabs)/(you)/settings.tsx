import { router } from 'expo-router';
import { Switch, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { TogetherEditor } from '@/components/home/together-editor';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useNotificationPrefs } from '@/hooks/use-notification-prefs';
import { usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, space } from '@/constants/tokens';

/** Settings & account management (PRD §5). */
export default function Settings() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const { isPremium } = usePremium();
  const { prefs, toggle } = useNotificationPrefs();

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
        {/*
          * Three categories, matching what the sender can actually tell apart.
          *
          * These used to read "Streak warnings" / "Partner check-ins" /
          * "Countdowns" against three `useState` booleans that went nowhere.
          * Streaks and countdowns are the same thing to `wants_notification()` —
          * both are `reminder.*` — so offering them as separate switches would
          * promise a distinction the system cannot honour. Play activity, which
          * genuinely is its own category and is the noisiest of the three, had
          * no switch at all.
          *
          * Only push obeys these. The in-app list still records everything:
          * turning one off means "stop buzzing me", not "hide this from the
          * screen I opened deliberately".
          */}
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <ListRow
            label="Partner check-ins"
            sublabel="When they log how their day is going"
            right={
              <Switch
                value={prefs.partnerCheckins}
                onValueChange={() => void toggle('partnerCheckins')}
                trackColor={{ true: palette.brand.rose }}
              />
            }
          />
          <ListRow
            label="Play activity"
            sublabel="Flips, spins, quiz scores and matches"
            right={
              <Switch
                value={prefs.playActivity}
                onValueChange={() => void toggle('playActivity')}
                trackColor={{ true: palette.brand.rose }}
              />
            }
          />
          <ListRow
            label="Reminders"
            sublabel="Streak warnings and date countdowns"
            last
            right={
              <Switch
                value={prefs.reminders}
                onValueChange={() => void toggle('reminders')}
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
