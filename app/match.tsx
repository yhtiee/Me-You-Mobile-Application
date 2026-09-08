import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Glyph } from '@/components/ui/glyph';
import { Text } from '@/components/ui/text';
import { radius, shadow, space } from '@/constants/tokens';
import { usePlayPeople } from '@/hooks/use-play';

/** Both swiped right (PRD Module 2). */
export default function MatchDialog() {
  const { partner } = usePlayPeople();
  const partnerName = partner?.name ?? 'They';
  const { title, imageUrl, meta, rating } = useLocalSearchParams<{
    title?: string;
    imageUrl?: string;
    meta?: string;
    rating?: string;
  }>();

  return (
    <Dialog
      title={title ? `You both chose ${title}!` : 'You both said yes!'}
      subtitle={`${partnerName} picked this one too. That’s tonight sorted.`}
      actions={
        <>
          <Button
            label="Put it in the calendar"
            full
            onPress={() => {
              router.back();
              router.push({
                pathname: '/add-event',
                params: { title: title ? `Watch ${title}` : 'Movie Night' },
              });
            }}
          />
          <Button label="Keep swiping" variant="neutral" full onPress={() => router.back()} />
        </>
      }
    >
      <View style={{ alignItems: 'center', paddingVertical: space.md, gap: space.sm }}>
        {imageUrl ? (
          <View
            style={{
              width: 140,
              height: 200,
              borderRadius: radius.lg,
              overflow: 'hidden',
              boxShadow: shadow.s2,
              position: 'relative',
              backgroundColor: '#1E1B24',
            }}
          >
            <Image
              source={{ uri: imageUrl }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
            {rating ? (
              <View
                style={{
                  position: 'absolute',
                  top: space.xs,
                  right: space.xs,
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  paddingHorizontal: space.xs,
                  paddingVertical: 2,
                  borderRadius: radius.pill,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Text role="caption" color="#F59E0B" style={{ fontSize: 11, fontWeight: '800' }}>
                  ★
                </Text>
                <Text role="caption" tabular color="#FFFFFF" style={{ fontSize: 11, fontWeight: '700' }}>
                  {rating}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Glyph size={56}>🍿</Glyph>
        )}

        {meta ? (
          <Text role="caption" color="rgba(255,255,255,0.7)" center>
            {meta}
          </Text>
        ) : null}
      </View>
    </Dialog>
  );
}
