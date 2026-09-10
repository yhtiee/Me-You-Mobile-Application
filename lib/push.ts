import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { ensurePermission, isSupported, notificationsApi } from '@/lib/notifications';

/**
 * Remote push registration.
 *
 * Split from `lib/notifications.ts` rather than added to it, because the two
 * are different features that only share a dependency: that file schedules
 * *local* reminders on this device, this one tells the server where to reach
 * this device. They are deployed differently too — local notifications have
 * always worked, push needs a development build.
 *
 * What they do share is the lazy `require` guard, which is imported rather than
 * duplicated. Everything here goes through it, so on a runtime that cannot load
 * `expo-notifications` — Expo Go on Android — this degrades to a no-op instead
 * of taking the route tree down with it. That failure has happened once in this
 * codebase already and is documented at the top of `lib/notifications.ts`.
 */

/**
 * The EAS project id, which `getExpoPushTokenAsync` requires and will not infer.
 *
 * Read from the resolved manifest rather than hardcoded: it is already in
 * `app.json` under `extra.eas.projectId`, and a second copy is a second thing
 * to get wrong when the project is transferred or duplicated.
 */
function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

/**
 * The channel every server-sent notification lands in.
 *
 * Must exist *before* a token is fetched — the SDK 57 docs are explicit that
 * channels are created first — and must match `defaultChannel` in the
 * `expo-notifications` plugin config, or Android silently files pushes under a
 * channel the user has never seen and cannot tune.
 *
 * Separate from the `calendar` channel in `lib/notifications.ts` on purpose: a
 * person who wants their partner's check-ins but not their own event reminders
 * should be able to say so in Android's own settings, and channels are how
 * Android expresses that.
 */
async function ensureDefaultChannel(): Promise<void> {
  const Notifications = notificationsApi();
  if (!Notifications || Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'From your partner',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    // The brand rose, matching the plugin's `color`. Android tints the small
    // icon and the LED with this.
    lightColor: '#F0546F',
  });
}

/**
 * Register this device to receive push, and store where to reach it.
 *
 * Safe to call on every sign-in. The token is stable for an installation, so
 * the common case is an upsert that changes nothing but `updated_at` — and the
 * uncommon cases are exactly the ones worth catching: a reinstall issues a new
 * token, and signing in as a different person on the same phone has to move
 * that token's ownership rather than leave it pointing at the previous account.
 *
 * Returns the token for logging, or null when push is unavailable — which is
 * not an error. Expo Go, a simulator, and a user who declined the permission
 * prompt all land here, and none of them should surface anything to the user.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  const Notifications = notificationsApi();
  if (!Notifications || !isSupported()) return null;

  const id = projectId();
  if (!id) {
    console.warn('No EAS projectId in app config; skipping push registration.');
    return null;
  }

  /*
   * No explicit simulator check. `Constants.isDevice` was removed from
   * expo-constants in SDK 57 and the replacement lives in `expo-device`, which
   * this project does not depend on. Adding a native package to detect the one
   * case the `try` below already handles — `getExpoPushTokenAsync` throws on a
   * simulator — would be a dependency bought to avoid a catch block.
   */

  // Channel first, then permission, then token — this order is required on
  // Android, where a token fetched before a channel exists can be filed against
  // one that does not.
  await ensureDefaultChannel();

  // Reuses the local-notification permission flow, which already handles the
  // "denied in a previous session, cannot ask again" case that Android 13's
  // runtime POST_NOTIFICATIONS prompt and iOS both have.
  const granted = await ensurePermission();
  if (!granted) return null;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (!token) return null;

    const { error } = await supabase.from('device_push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      // On the token, not on (user_id, token): see the index note in 0025. This
      // is what reassigns a shared phone to whoever is signed in now.
      { onConflict: 'token' }
    );

    if (error) {
      // Not surfaced. Push is an enhancement to a notification the user already
      // gets in-app, so a failed registration must not interrupt a sign-in.
      console.warn('Could not store push token:', error.message);
    }

    return token;
  } catch (thrown) {
    console.warn('Push registration failed:', thrown);
    return null;
  }
}

/**
 * Forget this device on sign-out.
 *
 * Without it, the next notification for the account that just left is delivered
 * to a phone now being used by someone else. The upsert above would eventually
 * move the row on the next sign-in, but "eventually" is after the window in
 * which the wrong person reads it.
 */
export async function unregisterForPush(): Promise<void> {
  const Notifications = notificationsApi();
  if (!Notifications) return;

  const id = projectId();
  if (!id) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (token) await supabase.from('device_push_tokens').delete().eq('token', token);
  } catch {
    // A sign-out must never fail because a token could not be read.
  }
}
