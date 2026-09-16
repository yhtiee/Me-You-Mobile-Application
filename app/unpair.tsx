import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useCouple } from '@/components/providers/couple-provider';
import { partnerNameInSentence, useCouplePeople } from '@/hooks/use-couple-people';

/** Destructive confirm (PRD §5, Unpair / Re-pair). */
export default function UnpairDialog() {
  const { unpair } = useCouple();
  const people = useCouplePeople();

  return (
    <Dialog
      title={`Unpair from ${partnerNameInSentence(people)}?`}
      subtitle="Your streak, shared goals and the wiki all go with it. This can't be undone from here."
      actions={
        <>
          <Button
            label="Unpair"
            variant="destructive"
            full
            onPress={() => {
              // Not yet a real unpair. This is the mock provider's `unpair`, which
              // only flips local state; the couple membership in Postgres is
              // untouched, so the auth gate still sees a paired user. The server
              // side exists as `leave_couple()` (0002) and is not called here.
              unpair();
              router.dismissAll();
              router.replace('/pair');
            }}
          />
          <Button label="Keep us together" variant="neutral" full onPress={() => router.back()} />
        </>
      }
    />
  );
}
