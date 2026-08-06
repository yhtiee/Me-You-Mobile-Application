import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useCouple } from '@/components/providers/couple-provider';

/** Destructive confirm (PRD §5, Unpair / Re-pair). */
export default function UnpairDialog() {
  const { partner, unpair } = useCouple();

  return (
    <Dialog
      title={`Unpair from ${partner.name}?`}
      subtitle="Your streak, shared goals and the wiki all go with it. This can't be undone from here."
      actions={
        <>
          <Button
            label="Unpair"
            variant="destructive"
            full
            onPress={() => {
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
