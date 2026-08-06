import { Stack } from 'expo-router/stack';

import { stackScreenOptions } from '@/constants/nav-options';

export const unstable_settings = {
  anchor: 'index',
};

export default function OnboardingStack() {
  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerShown: false }}>
      {/* `index` is the brand intro; it `replace`s into the walkthrough, so
          there is deliberately nothing to go back to. */}
      <Stack.Screen name="index" />
      <Stack.Screen name="walkthrough" options={{ gestureEnabled: false }} />
      <Stack.Screen name="auth" />
      {/* Headered, unlike `auth`, because it is only ever reached by a push. */}
      <Stack.Screen name="login" options={{ headerShown: true, title: 'Log in' }} />
      <Stack.Screen name="pair" />
      <Stack.Screen name="create-hub" options={{ headerShown: true, title: 'Your couple code' }} />
      <Stack.Screen name="join-partner" options={{ headerShown: true, title: 'Join your partner' }} />
      <Stack.Screen name="paired" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
