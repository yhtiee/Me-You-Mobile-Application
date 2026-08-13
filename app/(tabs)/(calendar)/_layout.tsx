import { Stack } from 'expo-router/stack';

import { stackScreenOptions } from '@/constants/nav-options';

export default function CalendarStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Calendar' }} />
      <Stack.Screen name="add-event" options={{ title: 'New date' }} />
    </Stack>
  );
}
