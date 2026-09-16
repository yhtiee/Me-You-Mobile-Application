import { useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '@/components/providers/auth-provider';

/** Onboarding screens a signed-in user has already finished with. */
const PRE_AUTH_SCREENS = new Set(['index', 'auth', 'login', 'walkthrough']);

/** The celebration a newly linked couple sees before the app. */
const PAIRED_SCREEN = 'paired';

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

    // Typed routes narrow `useSegments()` to a union of route tuples, some of
    // them a single segment long, so indexing past [0] no longer typechecks.
    // The gate is deliberately generic over the whole tree — widen rather than
    // enumerate every route in it.
    const [group, second] = segments as readonly string[];
    const inOnboarding = group === '(onboarding)';
    // The group's index route reports no second segment.
    const screen = second ?? 'index';

    // The splash / intro screen (index) handles its own transition after animation and session load.
    if (inOnboarding && screen === 'index') return;

    if (status === 'signed-out') {
      if (!inOnboarding || !PRE_AUTH_SCREENS.has(screen)) router.replace('/login');
      return;
    }

    if (pairing === 'paired') {
      if (!inOnboarding || screen === PAIRED_SCREEN) return;
      /*
       * Someone who was mid-pairing just got linked — by their own code, or by
       * their partner redeeming theirs while this screen was open (realtime
       * refreshes pairing now). They get the "you're linked" moment first.
       * Anyone arriving from login was already paired: straight to the app.
       */
      router.replace(PRE_AUTH_SCREENS.has(screen) ? '/(tabs)/(home)' : '/paired');
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
