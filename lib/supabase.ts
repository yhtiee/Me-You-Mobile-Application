import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

/**
 * The one Supabase client.
 *
 * Read from `EXPO_PUBLIC_*`, which means these values are compiled into the app
 * bundle. That is correct for the publishable key — it is designed to be public
 * and every table it can reach is guarded by the RLS policies in
 * `supabase/migrations/0007_rls.sql`. It is emphatically wrong for the service
 * role key, which bypasses those policies; that key must never appear in this
 * file, in `.env`, or anywhere else the client can see.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  // Thrown at import rather than handled per call: without these, every request
  // fails anyway, and a clear crash on launch beats a screenful of network
  // errors that look like the backend is down.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Add them to .env and restart the dev server — Expo only reads env vars at startup.'
  );
}

const storageAdapter = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(url, publishableKey, {
  auth: {
    /**
     * AsyncStorage, not SecureStore. SecureStore is the safer home for a token,
     * but it caps values at 2048 bytes and a Supabase session carrying a JWT
     * with custom claims runs past that — the write fails silently and the user
     * is signed out on every cold start. Chunking across SecureStore keys is the
     * fix if this ever needs hardening; see the API-layer notes.
     */
    storage: storageAdapter,
    persistSession: true,
    autoRefreshToken: true,

    /**
     * URL-based session detection is a web concept: it reads the OAuth callback
     * out of `window.location`. There is no such thing here, and leaving it on
     * makes the client probe for a URL that does not exist on every launch.
     */
    detectSessionInUrl: false,
  },
});

/**
 * Only refresh tokens while the app is foregrounded.
 *
 * Supabase's auto-refresh runs on a timer. Left running in the background it
 * keeps firing network calls the OS may never deliver, and on wake it can
 * stampede several refreshes at once against a token that has already rotated.
 * Pausing on background and resuming on active is the documented pattern.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
