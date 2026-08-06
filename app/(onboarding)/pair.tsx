import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronIcon, HubIcon, JoinIcon } from '@/components/ui/icons';
import { PairIllustration } from '@/components/onboarding/pair-illustration';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, radius, space } from '@/constants/tokens';

/** PRD §3 couple linkage: one of you creates the hub, the other joins it. */
export default function PairChoice() {
  const theme = useTheme();
  const { signOut } = useAuth();

  return (
    <Screen topPad={space.xl} gap={space.xl}>
      <PairIllustration />

      <View style={{ gap: space.md }}>
        <Text role="title1">Two of you, one hub</Text>
        <Text role="body" color={theme.color.textSecondary}>
          One of you sets it up and shares a code. The other joins with it. Takes about ten seconds.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        <Option
          icon={<HubIcon color={palette.brand.rose} />}
          tint={palette.brand.roseSoft}
          title="Create our hub"
          body="You’ll get a 6-character code and a QR to share."
          onPress={() => router.push('/create-hub')}
        />
        <Option
          icon={<JoinIcon color={palette.brand.iris} />}
          tint={palette.brand.irisSoft}
          title="Join my partner"
          body="Already have their code? Enter it here."
          onPress={() => router.push('/join-partner')}
        />
        <Button
          label="Log out"
          variant="neutral"
          full
          onPress={signOut}
        />
      </View>
    </Screen>
  );
}

function Option({
  icon,
  tint,
  title,
  body,
  onPress,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: tint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text role="cardTitle">{title}</Text>
          <Text role="caption" color={theme.color.textSecondary}>
            {body}
          </Text>
        </View>
        <ChevronIcon color={theme.color.textTertiary} />
      </Card>
    </Pressable>
  );
}
