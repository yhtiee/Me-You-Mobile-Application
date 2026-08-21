import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Glyph } from '@/components/ui/glyph';
import { usePlayPeople } from '@/hooks/use-play';
import { space } from '@/constants/tokens';

/** Both swiped right (PRD Module 2). */
export default function MatchDialog() {
  const { partner } = usePlayPeople();
  const partnerName = partner?.name ?? 'They';

  return (
    <Dialog
      title="You both said yes"
      subtitle={`${partnerName} picked this one too. That’s tonight sorted.`}
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
        <Glyph size={48}>🍿</Glyph>
      </View>
    </Dialog>
  );
}
