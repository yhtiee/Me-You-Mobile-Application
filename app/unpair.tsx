import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { partnerNameInSentence, useCouplePeople } from '@/hooks/use-couple-people';
import { usePremium } from '@/hooks/use-premium';

/**
 * Destructive confirm (PRD §5, Unpair / Re-pair).
 *
 * Ends the hub for both people through the `leave-hub` function. Everything
 * the two of you share goes; each of you keeps your account, to-dos and coach
 * chats, and can start or join a new hub straight after.
 *
 * No navigation on success: pairing flips to `unpaired` and the auth gate moves
 * this device to the pairing flow, the same way it will move the partner's.
 */
export default function UnpairDialog() {
  const theme = useTheme();
  const { unpair } = useAuth();
  const { isPremium } = usePremium();
  const people = useCouplePeople();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partner = partnerNameInSentence(people);

  const confirm = async () => {
    setPending(true);
    setError(null);
    const result = await unpair();
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    // Close the dialog and the settings stack under it; the gate does the rest.
    router.dismissAll();
  };

  return (
    <Dialog
      title={`Unpair from ${partner}?`}
      subtitle={`This ends your hub for both of you. Your streak, check-ins, calendar, photos, wiki and games are deleted, and ${partner} will be told. This can’t be undone.`}
      actions={
        <>
          <Button
            label={pending ? 'Unpairing…' : 'Unpair'}
            variant="destructive"
            full
            disabled={pending}
            onPress={() => void confirm()}
          />
          <Button
            label="Keep us together"
            variant="neutral"
            full
            disabled={pending}
            onPress={() => router.back()}
          />
        </>
      }
    >
      <Text role="caption" color={theme.color.textSecondary}>
        You both keep your accounts, to-dos and coach chats, and can start a new hub any time.
      </Text>
      {isPremium ? (
        <Text role="caption" color={theme.tint.amber.fg}>
          Your Premium subscription is yours and carries over to a new hub. Cancel it in your app store if you
          no longer want it.
        </Text>
      ) : null}
      {error ? (
        <Text role="caption" color={theme.color.danger} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Dialog>
  );
}
