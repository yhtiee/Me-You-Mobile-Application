import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { JoinIllustration } from '@/components/onboarding/join-illustration';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/components/providers/auth-provider';
import { useLoader } from '@/components/providers/loader-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { redeemCoupleCode } from '@/lib/pairing';
import { fontFamily, space } from '@/constants/tokens';

const CODE_LENGTH = 6;

/** PRD §3: User B enters User A's code and both accounts link. */
export default function JoinPartner() {
  const theme = useTheme();
  const toast = useToast();
  const loader = useLoader();
  const { refreshPairing } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isComplete = code.length === CODE_LENGTH;

  const join = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // Whole-screen loader rather than a button spinner: a successful redeem
    // re-routes the app, so the screen underneath is about to be replaced and
    // must not take another tap in the meantime.
    const hide = loader.show('Linking you up…');
    try {
      const result = await redeemCoupleCode(code);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // Refresh before navigating: `AuthGate` routes off pairing state, and a
      // stale 'unpaired' here would bounce us straight back to /pair.
      await refreshPairing();
      toast.success('You’re linked.');
      router.replace('/paired');
    } finally {
      hide();
      setSubmitting(false);
    }
  };

  return (
    // `flexGrow` is what gives the layout below something to push against: the
    // content box now fills the viewport even when the content is shorter.
    <Screen gap={space.xl} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ gap: space.md }}>
        <Text role="title2">Enter their code</Text>
        <Text role="body" color={theme.color.textSecondary}>
          Six characters, from the screen on their phone.
        </Text>
      </View>

      {/*
       * The illustration takes the slack instead of an empty gap. `flex: 1`
       * here does the job `marginTop: 'auto'` on the form used to: it soaks up
       * whatever room is left between the heading and the field, so the form
       * still rides the bottom edge and stays in thumb reach — but the space
       * between title and input is now occupied rather than blank.
       *
       * Handing it "100%" lets the drawing grow into that box on a tall phone
       * and shrink on a short one, instead of a fixed height that only suits
       * one device.
       */}
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 130 }}>
        <JoinIllustration height="100%" />
      </View>

      <View style={{ gap: space.xl }}>
        <TextField
          label="Couple code"
          placeholder="ABC123"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LENGTH}
          error={error}
          hint={`${code.length} of ${CODE_LENGTH}`}
          style={{
            fontFamily: fontFamily.display.bold,
            fontSize: 28,
            letterSpacing: 8,
            textAlign: 'center',
            paddingVertical: space.xl,
          }}
        />

        <Button
          label={submitting ? 'Linking…' : 'Link us up'}
          full
          disabled={!isComplete || submitting}
          onPress={join}
        />
      </View>
    </Screen>
  );
}
