import { Stack } from 'expo-router/stack';

import { stackScreenOptions } from '@/constants/nav-options';

export default function CoachStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Coach' }} />
      <Stack.Screen name="history" options={{ title: 'Past conversations' }} />
    </Stack>
  );
}
