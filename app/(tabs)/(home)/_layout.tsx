import { Stack } from 'expo-router/stack';

import { renderHomeHeader } from '@/components/ui/screen-header';
import { stackScreenOptions } from '@/constants/nav-options';
import { PLAY_GAMES } from '@/constants/play';

export default function HomeStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/* The one screen with the avatar-and-greeting header. Everything below
          it takes the shared back / title / bell bar. */}
      <Stack.Screen name="index" options={{ header: renderHomeHeader }} />

      {/* The old Home segments, promoted to screens of their own. */}
      <Stack.Screen name="us" options={{ title: 'Us' }} />
      <Stack.Screen name="play" options={{ title: 'Play' }} />
      <Stack.Screen name="todos" options={{ title: 'Just for you' }} />

      <Stack.Screen name="gallery" options={{ title: 'Your gallery' }} />
      <Stack.Screen name="wiki" options={{ title: 'Partner wiki' }} />
      <Stack.Screen name="add-goal" options={{ title: 'New goal' }} />
      <Stack.Screen name="bucket-list" options={{ title: 'Bucket list' }} />
      <Stack.Screen name="love-languages" options={{ title: 'Love languages' }} />
      {/* Titles come from the Play catalogue rather than being retyped here —
          the header and the tile you tapped to get to it were already drifting
          apart ("Games" vs "Games & growth"). */}
      {PLAY_GAMES.map((game) => (
        <Stack.Screen
          key={game.key}
          name={`tools/${game.key}`}
          options={{ title: game.title }}
        />
      ))}
    </Stack>
  );
}
