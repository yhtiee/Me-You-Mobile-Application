import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useCouple } from '@/components/providers/couple-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { createCouple } from '@/lib/pairing';
import { palette, space } from '@/constants/tokens';

/** PRD §3: User A receives a unique 6-character Couple ID / QR code. */
export default function CreateHub() {
  const theme = useTheme();
  const toast = useToast();
  const { refreshPairing, signOut } = useAuth();
  const { pair } = useCouple();
  const [coupleCode, setCoupleCode] = useState<string | null>(null);

  /**
   * The hub is created on arrival, not on a button press — this screen exists
   * to show a code, so there is nothing to look at until one exists.
   *
   * Safe to run on every mount: `create_couple()` returns the caller's existing
   * couple rather than making a second one, so a back-swipe and re-entry does
   * not strand an orphaned hub with a code nobody will ever redeem.
   */
  useEffect(() => {
    let active = true;

    void createCouple().then(async (result) => {
      if (!active) return;

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setCoupleCode(result.data.invite_code);
      await refreshPairing();
    });

    return () => {
      active = false;
    };
  }, [toast, refreshPairing]);

  return (
    <Screen gap={space.xl} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text role="title2">Share this with them</Text>
          {/* <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={signOut} hitSlop={8}>
            <Text role="caption" color={palette.light.danger} style={{ fontFamily: 'Manrope_700Bold' }}>
              Log out
            </Text>
          </Pressable> */}
        </View>
        <Text role="body" color={theme.color.textSecondary}>
          They enter the code — or scan the square — and you’re linked. It only works once.
        </Text>
      </View>

      <View style={{flex: 1, flexDirection: "column", justifyContent: "space-between"}}>
        {/*
         * Nothing renders until the code arrives. A QR built from `undefined`
         * encodes a real, scannable, wrong URL — worse than an empty space,
         * because it looks finished.
         */}
        <Card style={{ alignItems: 'center', gap: space.xl, paddingVertical: space.xxl }}>
          {coupleCode ? (
            <>
              <View style={{ padding: space.md, backgroundColor: '#fff', borderRadius: 12 }}>
                <QRCode
                  value={`meyou://join/${coupleCode}`}
                  size={168}
                  color={palette.light.textPrimary}
                  backgroundColor="#fff"
                />
              </View>

              <View style={{ alignItems: 'center', gap: space.sm - 2 }}>
                <Text role="overline" color={theme.color.textTertiary}>
                  Couple code
                </Text>
                <Text
                  role="display"
                  selectable
                  tabular
                  style={{ fontSize: 34, letterSpacing: 6 }}
                >
                  {coupleCode}
                </Text>
              </View>
            </>
          ) : (
            <View style={{ height: 168 + space.xl + 60, justifyContent: 'center' }}>
              <Text role="body" center color={theme.color.textTertiary}>
                Making your code…
              </Text>
            </View>
          )}
        </Card>

        <View style={{ gap: space.md }}>
          <Button
            label="Share code"
            full
            disabled={!coupleCode}
            onPress={async () => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              await Share.share({
                message: `Join me on Me&u — our code is ${coupleCode}`,
              });
            }}
          />
          <Button
            label="They’ve joined"
            variant="secondary"
            full
            onPress={async () => {
              pair();
              // The partner's redeem happens on their device, so this screen
              // has to ask the server whether it actually landed.
              await refreshPairing();
              router.replace('/paired');
            }}
          />
          <Button
            label="Log out"
            variant="neutral"
            full
            onPress={signOut}
          />
          <Text role="caption" center color={theme.color.textTertiary}>
            Waiting for them to join…
          </Text>
        </View>
      </View>
    </Screen>
  );
}
