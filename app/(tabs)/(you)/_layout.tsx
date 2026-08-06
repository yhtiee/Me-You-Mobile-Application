import { Stack } from 'expo-router/stack';

import { rootScreenOptions, stackScreenOptions } from '@/constants/nav-options';

export default function YouStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ ...rootScreenOptions, title: 'You' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
