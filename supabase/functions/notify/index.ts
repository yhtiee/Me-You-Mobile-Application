/**
 * Push delivery for the notifications 0020 already writes.
 *
 * Invoked by a Supabase Database Webhook on `INSERT INTO public.notifications`,
 * not called from the app. That choice is the whole design:
 *
 *   - The recipient is by definition the person who did *not* act, so their
 *     device is not the one making the write. A client-sent push would mean
 *     trusting one partner's app to describe what it just did to the other.
 *   - It cannot be skipped. A push that depends on the acting client remembering
 *     to send it silently does not happen from an older build, a dropped
 *     request, or a backgrounded app.
 *   - Every push is *exactly* an in-app row that already exists, so the bell and
 *     the banner can never disagree, and nothing here re-decides what is worth
 *     notifying about.
 *
 * If this function fails, the in-app notification still exists. That is the
 * intended failure mode and the reason push rides on the row rather than
 * replacing it.
 *
 * Contract: POST { type, table, record } (the webhook's shape) -> 200 always.
 * A non-200 makes Postgres' webhook worker retry, and a retry on a *delivery*
 * problem re-sends a notification the user may already have seen. Failures are
 * logged and swallowed.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Optional. Expo accepts unauthenticated sends by default; setting an access
 * token in the Expo dashboard and this secret turns that off, which is worth
 * doing before launch — without it, anyone holding one of your push tokens can
 * send to it.
 */
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo's documented cap. Larger requests are rejected outright. */
const MAX_PER_REQUEST = 100;

type NotificationRow = {
  id: string;
  couple_id: string;
  recipient_id: string;
  actor_id: string | null;
  kind: string;
  payload: Record<string, unknown> | null;
};

/**
 * The sentence to show, per kind.
 *
 * Deliberately a near-copy of `describe()` in `app/notifications.tsx`, not a
 * shared module: an Edge Function runs on Deno and the app is a React Native
 * bundle, so they have no module in common. The duplication is real and the
 * cost of drift is two channels wording the same event differently — keep them
 * in step by hand, and prefer changing both in one commit.
 *
 * The actor's name is resolved by the caller and passed in, because only the
 * database knows it and only at send time.
 */
function describe(row: NotificationRow, actorName: string): { title: string; body: string } {
  const p = row.payload ?? {};

  switch (row.kind) {
    case 'checkin': {
      const battery = typeof p.battery === 'number' ? p.battery : null;
      return {
        title: `${actorName} checked in`,
        body: battery !== null ? `Feeling ${battery}% loved today.` : 'See how they’re doing.',
      };
    }
    case 'play.coin':
      return {
        title: `${actorName} flipped the coin`,
        body: typeof p.stake === 'string' && p.stake ? p.stake : 'Someone had to go first.',
      };
    case 'play.wheel':
      return {
        title: `${actorName} spun the wheel`,
        body: typeof p.landed_on === 'string' ? `It landed on ${p.landed_on}.` : 'Go and look.',
      };
    case 'play.trivia': {
      const score = typeof p.score === 'number' ? p.score : null;
      const total = typeof p.total === 'number' ? p.total : null;
      return {
        title: `${actorName} took the quiz`,
        body: score !== null && total !== null ? `Scored ${score} out of ${total}.` : 'See how they did.',
      };
    }
    case 'play.match':
      return {
        title: 'You matched',
        body: typeof p.title === 'string' ? `You both liked ${p.title}.` : 'You both said yes.',
      };
    default:
      // A newer client writing a kind this deployment has not learned yet gets a
      // dull notification rather than none. Silence would look like a bug.
      return { title: 'Me&u', body: `${actorName} did something.` };
  }
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    const row = body?.record as NotificationRow | undefined;

    // Webhooks fire on the table, so ignore anything that is not the insert we
    // asked for rather than assuming the payload shape.
    if (!row?.recipient_id || !row?.kind) {
      return ok('ignored: not a notification insert');
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    /*
     * Does the recipient want this kind?
     *
     * Checked here rather than in the trigger on purpose: the in-app row should
     * exist regardless of push preferences. Turning off "partner check-ins"
     * means "stop buzzing my phone", not "hide this from the list I opened
     * deliberately".
     */
    const { data: wanted } = await admin.rpc('wants_notification', {
      p_user_id: row.recipient_id,
      p_kind: row.kind,
    });

    if (wanted === false) return ok('suppressed by preference');

    const { data: tokens } = await admin
      .from('device_push_tokens')
      .select('token')
      .eq('user_id', row.recipient_id);

    const addresses = (tokens ?? []).map((t: { token: string }) => t.token);
    if (addresses.length === 0) return ok('no registered devices');

    let actorName = 'Your partner';
    if (row.actor_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('display_name')
        .eq('id', row.actor_id)
        .maybeSingle();

      if (profile?.display_name) actorName = profile.display_name;
    }

    const { title, body: text } = describe(row, actorName);

    const messages = addresses.map((to) => ({
      to,
      title,
      body: text,
      sound: 'default',
      channelId: 'default',
      // Carried so a tap can deep-link once the app handles that; harmless
      // until then, and cheap to add now rather than re-deploying later.
      data: { notificationId: row.id, kind: row.kind },
    }));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;

    const dead: string[] = [];

    for (let i = 0; i < messages.length; i += MAX_PER_REQUEST) {
      const batch = messages.slice(i, i + MAX_PER_REQUEST);

      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        console.error('Expo push rejected the batch:', res.status, await res.text());
        continue;
      }

      /*
       * Tickets, not receipts.
       *
       * A ticket says Expo accepted the message; a receipt (fetched separately,
       * ~15 minutes later per the docs) says FCM or APNs delivered it. Full
       * receipt polling needs a scheduled job and is not built here.
       *
       * The one ticket error worth acting on immediately is `DeviceNotRegistered`,
       * which means the app was uninstalled or the token rotated. Left alone,
       * those rows accumulate forever and every future send wastes a slot on an
       * address nobody answers.
       */
      const json = await res.json().catch(() => null);
      const tickets = json?.data ?? [];

      tickets.forEach((ticket: { status?: string; details?: { error?: string } }, index: number) => {
        if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          dead.push(batch[index].to);
        }
      });
    }

    if (dead.length > 0) {
      await admin.from('device_push_tokens').delete().in('token', dead);
    }

    return ok(`sent to ${addresses.length - dead.length} device(s)`);
  } catch (err) {
    // Swallowed, and 200 anyway. See the contract note at the top: a retry would
    // re-send rather than repair.
    console.error('notify failed:', err);
    return ok('error logged');
  }
});

function ok(message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
