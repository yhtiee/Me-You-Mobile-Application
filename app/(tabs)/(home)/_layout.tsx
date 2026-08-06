import { Stack } from 'expo-router/stack';

import { rootScreenOptions, stackScreenOptions } from '@/constants/nav-options';

export default function HomeStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ ...rootScreenOptions, title: 'Me&u' }} />

      {/* The old Home segments, promoted to screens of their own. */}
      <Stack.Screen name="us" options={{ title: 'Us' }} />
      <Stack.Screen name="play" options={{ title: 'Play' }} />
      <Stack.Screen name="todos" options={{ title: 'Just for you' }} />

      <Stack.Screen name="wiki" options={{ title: 'Partner wiki' }} />
      <Stack.Screen name="add-goal" options={{ title: 'New goal' }} />
      <Stack.Screen name="bucket-list" options={{ title: 'Bucket list' }} />
      <Stack.Screen name="tools/coin" options={{ title: 'Bigger person' }} />
      <Stack.Screen name="tools/wheel" options={{ title: 'Whose turn' }} />
      <Stack.Screen name="tools/date" options={{ title: 'Date setter' }} />
      <Stack.Screen name="tools/picker" options={{ title: 'Movie & meal' }} />
      <Stack.Screen name="tools/games" options={{ title: 'Games' }} />
    </Stack>
  );
}
