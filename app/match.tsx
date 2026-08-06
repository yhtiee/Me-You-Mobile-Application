import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { useCouple } from '@/components/providers/couple-provider';
import { space } from '@/constants/tokens';

/** Both swiped right (PRD Module 2). */
export default function MatchDialog() {
  const { partner } = useCouple();

  return (
    <Dialog
      title="You both said yes"
      subtitle={`${partner.name} picked this one too. That’s tonight sorted.`}
      actions={
        <>
          <Button
            label="Put it in the calendar"
            full
            onPress={() => {
              router.back();
              router.push('/add-event');
            }}
          />
          <Button label="Keep swiping" variant="neutral" full onPress={() => router.back()} />
        </>
      }
    >
      <View style={{ alignItems: 'center', paddingVertical: space.md }}>
        <Text style={{ fontSize: 48 }}>🍿</Text>
      </View>
    </Dialog>
  );
}
