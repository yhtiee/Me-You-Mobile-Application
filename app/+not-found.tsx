import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { gutter, space } from '@/constants/tokens';

export default function NotFound() {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.bgBase,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: gutter,
        gap: space.lg,
      }}
    >
      <Text role="title2" center>
        Nothing here
      </Text>
      <Text role="body" center color={theme.color.textSecondary}>
        That screen doesn’t exist — or it moved.
      </Text>
      <Button label="Back to Home" onPress={() => router.replace('/(tabs)/(home)')} />
    </View>
  );
}
