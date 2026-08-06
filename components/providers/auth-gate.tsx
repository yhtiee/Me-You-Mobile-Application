import { useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '@/components/providers/auth-provider';

/** Onboarding screens a signed-in user has already finished with. */
const PRE_AUTH_SCREENS = new Set(['index', 'auth', 'login', 'walkthrough']);

/**
 * Sends people where their session says they belong.
 *
 * Three states, three destinations:
 *
 *   signed out            → onboarding
 *   signed in, unpaired   → the pairing flow
 *   signed in, paired     → the app
 *
 * It runs on segment changes rather than once at mount because expo-router can
 * restore a deep link before the session finishes loading — a user reopening a
 * notification link lands on a tab route with no session, and only a reactive
 * check catches that.
 *
 * Every move is `replace`, never `push`: a back-swipe out of the app and into
 * the login screen you just cleared is not navigation, it is a bug.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, pairing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Hold still until the persisted session has been read. Routing on a
    // half-known state is what makes returning users flash past onboarding.
    if (status === 'restoring') return;

    const group = segments[0];
    const inOnboarding = group === '(onboarding)';
    // The group's index route reports no second segment.
    const screen = segments[1] ?? 'index';

    // The splash / intro screen (index) handles its own transition after animation and session load.
    if (inOnboarding && screen === 'index') return;

    if (status === 'signed-out') {
      if (!inOnboarding || !PRE_AUTH_SCREENS.has(screen)) router.replace('/login');
      return;
    }

    if (pairing === 'paired') {
      if (inOnboarding) router.replace('/(tabs)/(home)');
      return;
    }

    if (pairing === 'unpaired') {
      // Anywhere inside the pairing flow is fine — only bounce off the screens
      // that come *before* having an account, and off the app itself.
      if (!inOnboarding || PRE_AUTH_SCREENS.has(screen)) router.replace('/pair');
    }

    // `pairing === 'unknown'` falls through deliberately. It means the lookup
    // failed rather than returned nothing, and moving a possibly-paired couple
    // back into pairing is worse than leaving them where they are.
  }, [status, pairing, segments, router]);

  return <>{children}</>;
}
