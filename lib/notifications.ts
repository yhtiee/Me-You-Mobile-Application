import { Platform } from 'react-native';

import { nextOccurrence, parseIsoDate } from '@/utils/date';
import type { CalendarEvent } from '@/types/domain';

/**
 * Local notifications for calendar reminders.
 *
 * **Local, not push.** Every reminder here is scheduled on the device by the
 * device, which is the right shape for this feature and not just the cheap one:
 * the trigger is a wall-clock time both partners' phones already know, so a
 * server round trip would add a delivery dependency and an Expo push token to
 * something that works offline and in airplane mode. The cost is that reminders
 * only exist on devices that have opened the app since the event was created —
 * which is why `sync()` runs on every calendar load rather than only on write.
 *
 * When this does need to become server push (a nudge that must arrive even if
 * one partner never opens the app), the seam is `sync()`: the reminder rows are
 * already shared in Postgres, so an Edge Function reading `event_reminders`
 * replaces this file without the calendar screen changing.
 */

/**
 * `expo-notifications`, or `null` on a runtime that cannot load it.
 *
 * Deliberately a lazy `require` rather than a static import, and this is
 * load-bearing rather than a style choice. On Android in Expo Go the module
 * *throws from its own module scope* — remote push was removed from the Go
 * client in SDK 53 — and a static `import` hoists that throw into the
 * evaluation of this file.
 *
 * That is not a contained failure. When this module died it took
 * `hooks/use-calendar` with it, and then both calendar routes, which reached
 * expo-router as `loadRoute()` returning `undefined` and crashed the entire tab
 * with `Cannot read property 'ErrorBoundary' of undefined` — an error naming
 * neither notifications nor Expo Go. A capability the runtime does not have
 * must degrade to a no-op; it must never take a route tree down with it.
 *
 * No environment sniffing. `Constants.executionEnvironment` does not cleanly
 * separate Expo Go from a dev client (its own typings say `storeClient` covers
 * both), and the question we actually need answered is "does this load here?",
 * which the `try` answers directly and stays correct on runtimes that do not
 * exist yet.
 *
 * Exported because `lib/push.ts` needs the same guard and must not grow a second
 * copy of it: two lazy requires means two chances for one of them to be a
 * static import again.
 */
type NotificationsModule = typeof import('expo-notifications');

/** `undefined` = not yet attempted, `null` = attempted and unavailable. */
let cached: NotificationsModule | null | undefined;

export function notificationsApi(): NotificationsModule | null {
  // Metro caches a module that threw and re-throws on every later `require`,
  // so this must run at most once — hence caching the failure, not just the
  // success.
  if (cached !== undefined) return cached;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }

  return cached;
}

/**
 * Whether reminders can ring on this device *at all*, before permission is
 * considered. False in Expo Go on Android; use a development build.
 */
export function isSupported(): boolean {
  return notificationsApi() !== null;
}

/** All-day events fire at 9am rather than midnight, which nobody is awake for. */
const ALL_DAY_HOUR = 9;

/**
 * iOS caps pending local notifications at 64 per app, silently dropping the
 * rest. A couple with a dozen annual events and three reminders each is already
 * at 36, so the schedule is trimmed to the soonest — a reminder eleven months
 * out is worth less than the guarantee that next week's still fires.
 */
const MAX_SCHEDULED = 48;

let handlerConfigured = false;

function configureHandler() {
  const Notifications = notificationsApi();
  if (!Notifications || handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask once, and report what we got.
 *
 * Never called at launch. A permission prompt on first open, before the user
 * has any events, is the one most reliably denied — and a denial is sticky, so
 * it costs the feature permanently. This runs when someone first adds a
 * reminder, at which point the prompt is obviously about the thing they just did.
 */
export async function ensurePermission(): Promise<boolean> {
  const Notifications = notificationsApi();
  // Not an error the caller has to branch on: "we cannot ring on this device"
  // and "you said no" land in the same place, and `toggleReminder` already
  // saves the reminder and tells the user either way.
  if (!Notifications) return false;

  configureHandler();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  // `canAskAgain` false means the user denied it in a previous session; iOS
  // will not show the sheet again and asking is a silent no-op.
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function hasPermission(): Promise<boolean> {
  const Notifications = notificationsApi();
  if (!Notifications) return false;

  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

/** Android puts notifications in channels; without one they arrive silently. */
async function ensureChannel() {
  const Notifications = notificationsApi();
  if (!Notifications || Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('calendar', {
    name: 'Dates & reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

/** When a reminder for this event should fire, or null if that moment has passed. */
function fireDate(event: CalendarEvent, leadMinutes: number, now: Date): Date | null {
  const occurrence = nextOccurrence(event.date, event.recursAnnually ?? false, now);
  const base = parseIsoDate(occurrence);

  if (event.time) {
    const [h, m] = event.time.split(':').map(Number);
    base.setHours(h ?? 0, m ?? 0, 0, 0);
  } else {
    base.setHours(ALL_DAY_HOUR, 0, 0, 0);
  }

  const at = new Date(base.getTime() - leadMinutes * 60_000);
  return at.getTime() > now.getTime() ? at : null;
}

function body(event: CalendarEvent, leadMinutes: number): string {
  if (leadMinutes === 0) return event.time ? `Today at ${event.time}.` : 'That’s today.';
  if (leadMinutes >= 1440) {
    const days = Math.round(leadMinutes / 1440);
    return days === 1 ? 'That’s tomorrow.' : `That’s in ${days} days.`;
  }
  const hours = Math.round(leadMinutes / 60);
  return hours <= 1 ? 'That’s in an hour.' : `That’s in ${hours} hours.`;
}

/**
 * Make the device's pending notifications match the calendar.
 *
 * Cancel-all-then-reschedule, deliberately, rather than diffing. The source of
 * truth is a shared table two people edit from two devices, so the local
 * schedule is a cache that is easiest to keep correct by rebuilding it — and
 * the alternative means tracking which identifier belongs to which reminder
 * across edits, deletions and an annual roll-over. Rebuilding a few dozen
 * entries costs milliseconds and cannot drift.
 *
 * No-ops without permission, so callers can fire it unconditionally.
 */
export async function sync(events: CalendarEvent[]): Promise<void> {
  const Notifications = notificationsApi();
  if (!Notifications) return;

  configureHandler();

  if (!(await hasPermission())) return;
  await ensureChannel();

  const now = new Date();

  const due = events
    .flatMap((event) =>
      (event.reminders ?? []).flatMap((reminder) => {
        const at = fireDate(event, reminder.leadMinutes, now);
        return at ? [{ event, reminder, at }] : [];
      })
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);

  await Notifications.cancelAllScheduledNotificationsAsync();

  await Promise.all(
    due.map(({ event, reminder, at }) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: event.title,
          body: body(event, reminder.leadMinutes),
          // Carried so a tap can open the right day once the screen accepts a
          // deep link; harmless until then.
          data: { eventId: event.id, date: event.date },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: 'calendar',
        },
      })
    )
  );
}

/** Drops every pending reminder. For sign-out and unpair. */
export async function clearAll(): Promise<void> {
  const Notifications = notificationsApi();
  if (!Notifications) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
}
