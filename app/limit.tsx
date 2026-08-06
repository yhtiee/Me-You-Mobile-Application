import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

/**
 * Free-tier coach cap reached. Copy follows the voice guide — "That's today's
 * three questions", never "Limit reached. Upgrade now!".
 */
export default function LimitDialog() {
  return (
    <Dialog
      title="That’s today’s three questions"
      subtitle="They reset in the morning. If you'd rather not wait, Premium takes the cap off entirely."
      actions={
        <>
          <Button
            label="See Premium · $1"
            variant="premium"
            full
            onPress={() => {
              router.back();
              router.push('/paywall');
            }}
          />
          <Button label="I’ll wait" variant="neutral" full onPress={() => router.back()} />
        </>
      }
    />
  );
}
