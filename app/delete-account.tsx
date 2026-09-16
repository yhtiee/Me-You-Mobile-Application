import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { partnerNameInSentence, useCouplePeople } from '@/hooks/use-couple-people';
import { usePremium } from '@/hooks/use-premium';
import { space } from '@/constants/tokens';

/**
 * Permanent account deletion — the in-app path Apple (5.1.1(v)) and Google Play
 * both require.
 *
 * One confirm, not a typed "DELETE": it is already two deliberate taps deep in
 * Settings, under a heading that says "Danger zone", and the dialog spells out
 * exactly what goes. What it must not do is look like "Log out", which is why
 * the consequences come before the button.
 *
 * On success there is nothing to navigate to: the session is cleared and the
 * auth gate takes the person back to the start, as it does for a sign-out.
 */
export default function DeleteAccountDialog() {
  const theme = useTheme();
  const { deleteAccount } = useAuth();
  const { isPremium } = usePremium();
  const people = useCouplePeople();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partner = partnerNameInSentence(people);

  const confirm = async () => {
    setPending(true);
    setError(null);
    const result = await deleteAccount();
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    router.dismissAll();
  };

  return (
    <Dialog
      title="Delete your account?"
      subtitle="This can’t be undone. We’ll permanently delete your profile, check-ins, to-dos, coach chats and everything written about you."
      actions={
        <>
          <Button
            label={pending ? 'Deleting…' : 'Delete my account'}
            variant="destructive"
            full
            disabled={pending}
            onPress={() => void confirm()}
          />
          <Button
            label="Keep my account"
            variant="neutral"
            full
            disabled={pending}
            onPress={() => router.back()}
          />
        </>
      }
    >
      <View style={{ gap: space.sm }}>
        <Text role="caption" color={theme.color.textSecondary}>
          {people.partner
            ? `Things you added to the hub, like photos and calendar events, stay for ${partner} without your name. You’ll leave the hub straight away.`
            : 'Your hub and everything in it will be deleted too.'}
        </Text>
        {isPremium ? (
          <Text role="caption" color={theme.tint.amber.fg}>
            Premium is billed by your app store. Cancel it there first, as deleting your account
            doesn’t stop the subscription.
          </Text>
        ) : null}
        {error ? (
          <Text role="caption" color={theme.color.danger} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </Dialog>
  );
}
