import { Stack } from 'expo-router/stack';

import { stackScreenOptions } from '@/constants/nav-options';

export default function YouStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'You' }} />
      <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
