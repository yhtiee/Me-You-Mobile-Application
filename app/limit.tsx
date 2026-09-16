import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/providers/toast-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useRewardedAd } from '@/hooks/use-rewarded-ad';
import { fetchRewardedRemaining, grantCoachBonus } from '@/lib/coach';

/**
 * Free-tier coach cap reached. Copy follows the voice guide — "That's today's
 * three questions", never "Limit reached. Upgrade now!".
 *
 * Three ways out, and the order is the hierarchy:
 *
 *   1. Premium, which removes the cap. Still the primary action; it is the
 *      product's revenue path and the dialog already led with it.
 *   2. A rewarded ad for one more question — offered only when it can actually
 *      be delivered.
 *   3. Waiting, which costs nothing and is never made to feel like the wrong
 *      answer.
 *
 * The rewarded option is the only ad in the app a person has to ask for, which
 * is why it is the one ad format allowed near a dialog. It follows AdMob's
 * rewarded rules to the letter: the reward is stated before anything plays,
 * nothing is granted unless the ad reports it was earned, and the offer is not
 * shown at all when no ad has loaded or the day's rewarded questions are used.
 * A button that plays an ad and then gives nothing would break the one promise
 * a rewarded ad makes.
 */
export default function LimitDialog() {
  const theme = useTheme();
  const toast = useToast();

  /** Null until asked. Zero hides the offer. */
  const [rewardedLeft, setRewardedLeft] = useState<number | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchRewardedRemaining().then((left) => {
      if (active) setRewardedLeft(left);
    });
    return () => {
      active = false;
    };
  }, []);

  // Only preload an ad when there is a reward to back it.
  const { available, show } = useRewardedAd((rewardedLeft ?? 0) > 0);
  const canOffer = available && (rewardedLeft ?? 0) > 0;

  const watch = async () => {
    if (unlocking) return;
    setUnlocking(true);

    const earned = await show();

    if (!earned) {
      // Closed before the end. No reward, and no second offer pushed at them: the
      // loaded ad is spent, so the option drops away and the dialog is left with
      // Premium and waiting. Immediately re-offering an ad someone just closed
      // would be nagging.
      setUnlocking(false);
      return;
    }

    try {
      const allowance = await grantCoachBonus();
      if (allowance === null) {
        toast.error('That’s today’s bonus questions used. They reset in the morning.');
      } else {
        toast.success('One more question unlocked.');
      }
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t unlock that.');
    }

    // Back to the composer, which picks up the new allowance over realtime.
    router.back();
  };

  return (
    <Dialog
      title="That’s today’s three questions"
      subtitle={
        canOffer
          ? 'They reset in the morning. Premium takes the cap off, or you can watch a short ad for one more.'
          : "They reset in the morning. If you'd rather not wait, Premium takes the cap off entirely."
      }
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

          {canOffer ? (
            <>
              <Button
                label={unlocking ? 'Loading…' : 'Watch a short ad · 1 more question'}
                variant="secondary"
                full
                disabled={unlocking}
                onPress={() => void watch()}
              />
              {/* The cap, stated honestly, so the offer never feels bottomless. */}
              <Text role="caption" center color={theme.color.textTertiary}>
                {/* No total here: the cap is defined server-side in 0026, and a
                    hardcoded "of 3" would be a second copy waiting to drift. */}
                {rewardedLeft} ad {rewardedLeft === 1 ? 'question' : 'questions'} left today
              </Text>
            </>
          ) : null}

          <Button label="I’ll wait" variant="neutral" full onPress={() => router.back()} />
        </>
      }
    />
  );
}
