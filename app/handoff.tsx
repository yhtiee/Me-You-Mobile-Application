import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Pressable, Share, View } from 'react-native';

import { SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useCouple } from '@/components/providers/couple-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { layout, radius, space } from '@/constants/tokens';

/**
 * Check-in reminder box hand-off (PRD Module 1): jump straight into a chat.
 *
 * None of these schemes exist in a simulator, so every option falls back to the
 * share sheet rather than throwing.
 */
const APPS = [
  { label: 'WhatsApp', glyph: '💚', scheme: 'whatsapp://send' },
  { label: 'Messages', glyph: '💬', scheme: process.env.EXPO_OS === 'ios' ? 'sms:' : 'sms:' },
  { label: 'Instagram', glyph: '📸', scheme: 'instagram://direct-inbox' },
];

export default function Handoff() {
  const theme = useTheme();
  const { partner } = useCouple();

  const open = async (scheme: string) => {
    try {
      const supported = await Linking.canOpenURL(scheme);
      if (supported) {
        await Linking.openURL(scheme);
      } else {
        await Share.share({ message: `Hey ${partner.name} — thinking about you.` });
      }
    } catch {
      await Share.share({ message: `Hey ${partner.name} — thinking about you.` });
    }
    router.back();
  };

  return (
    <SheetBody
      title={`Say something to ${partner.name}`}
      subtitle="No script needed. Even a short one counts."
    >
      <View style={{ gap: space.sm }}>
        {APPS.map((app) => (
          <Pressable
            key={app.label}
            accessibilityRole="button"
            accessibilityLabel={`Open ${app.label}`}
            onPress={() => open(app.scheme)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              minHeight: layout.minTarget + 6,
              paddingHorizontal: space.lg,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: theme.color.border,
            }}
          >
            <Text style={{ fontSize: 20 }}>{app.glyph}</Text>
            <Text role="bodyStrong" style={{ flex: 1 }}>
              {app.label}
            </Text>
            <Text role="body" color={theme.color.textTertiary}>
              ›
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ marginTop: 'auto' }}>
        <Text role="caption" center color={theme.color.textSecondary}>
          Later
        </Text>
      </Pressable>
    </SheetBody>
  );
}
