import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { StreakBadge } from '@/components/ui/streak-badge';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, radius, space } from '@/constants/tokens';

type Props = {
  youName: string;
  partnerName: string;
  youAvatar: string | null;
  partnerAvatar: string | null;
  togetherLabel: string;
  streak: number;
  onPressStreak: () => void;
};

/**
 * Couple photo + "Together 2 years, 4 months" counter (PRD Module 1).
 *
 * Photos are always user uploads — the spec is explicit that this is a drop
 * target, never an illustrated stand-in, so the empty state is a real invitation
 * to add one rather than a placeholder illustration.
 */
export function CoupleBanner({
  youName,
  partnerName,
  youAvatar,
  partnerAvatar,
  togetherLabel,
  streak,
  onPressStreak,
}: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        backgroundColor: theme.color.surface,
        padding: space.lg,
        gap: space.lg,
        boxShadow: '0 4px 18px rgba(34,26,43,0.06)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar uri={youAvatar} name={youName} ring={palette.person.you} />
          <Avatar uri={partnerAvatar} name={partnerName} ring={palette.person.partner} overlap />
        </View>
        <StreakBadge count={streak} onPress={onPressStreak} />
      </View>

      <View style={{ gap: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Together
        </Text>
        <Text role="title2">{togetherLabel}</Text>
      </View>
    </View>
  );
}

function Avatar({
  uri,
  name,
  ring,
  overlap,
}: {
  uri: string | null;
  name: string;
  ring: string;
  overlap?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={uri ? `${name}'s photo` : `Add ${name}'s photo`}
      style={{
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 3,
        borderColor: ring,
        backgroundColor: theme.color.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginLeft: overlap ? -14 : 0,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Text role="overline" color={theme.color.textTertiary}>
          Add
        </Text>
      )}
    </Pressable>
  );
}
