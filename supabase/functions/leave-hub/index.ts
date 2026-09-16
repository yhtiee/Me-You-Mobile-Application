/**
 * Unpair: ends the caller's hub for both people.
 *
 * A hub is a joint thing — one streak, one calendar, one wiki about each
 * other — so leaving it ends it, as the Unpair dialog says. Each person keeps
 * their account and everything private to them: to-dos, habits and coach
 * conversations reference the hub with `on delete set null` (checked against
 * the live schema when this was written), so they survive with no hub attached.
 *
 * Contract: POST (no body) with the user's session -> { ok: true } | { error }.
 *
 * Why a function and not the `leave_couple()` RPC:
 *   - gallery photos live in storage, which Postgres cannot delete from;
 *   - the partner has to find out now, on a phone that may be closed.
 *
 * Order:
 *   1. Broadcast `hub-ended` on the hub's realtime channel while both apps are
 *      still subscribed to it, so an open partner app leaves at once.
 *   2. Delete the gallery files.
 *   3. Delete the hub; every shared table cascades from it.
 *   4. Push the partner, for the case where their app is closed.
 *
 * Idempotent: a caller with no hub gets `{ ok: true }`, so a retry after a
 * dropped response is harmless.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

/** Must match migration 0011 and `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET`. */
const PUBLIC_BUCKET = Deno.env.get('AVATAR_BUCKET') ?? 'me&u';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Ids and counts only — never names or file paths. */
function log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

async function listAll(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${bucket}: ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) paths.push(path);
      else paths.push(...(await listAll(admin, bucket, path)));
    }
    if (data.length < PAGE) break;
  }
  return paths;
}

async function removeAll(admin: SupabaseClient, bucket: string, prefix: string): Promise<number> {
  const paths = await listAll(admin, bucket, prefix);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
  }
  return paths.length;
}

/**
 * Tells every app on the hub's channel to re-check its pairing.
 *
 * The topic must match `RealtimeProvider`'s `couple:<id>`. Sent through
 * Realtime's REST endpoint, so there is no socket to open and close here.
 * Best effort: the push and the app's own foreground check are the fallbacks.
 */
async function broadcastEnded(coupleId: string): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ topic: `couple:${coupleId}`, event: 'hub-ended', payload: {}, private: false }],
      }),
    });
    if (!res.ok) log('warn', 'broadcast.failed', { status: res.status });
  } catch (thrown) {
    log('warn', 'broadcast.failed', { message: String(thrown) });
  }
}

/** Best effort, like the broadcast: a failed push must not fail the unpair. */
async function pushEnded(admin: SupabaseClient, partnerIds: string[], leaverName: string): Promise<void> {
  if (!partnerIds.length) return;
  try {
    const { data: tokens } = await admin.from('device_push_tokens').select('token').in('user_id', partnerIds);
    if (!tokens?.length) return;

    const messages = tokens.map((t) => ({
      to: t.token,
      title: `${leaverName} ended your hub`,
      body: 'Your private notes are still yours. Start a new hub whenever you’re ready.',
      sound: 'default',
      channelId: 'default',
      data: { kind: 'hub.ended' },
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) log('warn', 'push.failed', { status: res.status });
  } catch (thrown) {
    log('warn', 'push.failed', { message: String(thrown) });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in to unpair.' }, 401);

  // The hub is found from the session, never from the request. There is no
  // way to end somebody else's hub from here.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: auth } = await caller.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return json({ error: 'Your session ended. Log in again, then try once more.' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const { data: membership, error: memberError } = await admin
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', uid)
      .is('left_at', null)
      .maybeSingle();
    if (memberError) throw new Error(`membership: ${memberError.message}`);
    if (!membership) return json({ ok: true });

    const coupleId = membership.couple_id as string;

    const { data: others, error: othersError } = await admin
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', coupleId)
      .neq('user_id', uid)
      .is('left_at', null);
    if (othersError) throw new Error(`partners: ${othersError.message}`);
    const partnerIds = (others ?? []).map((o) => o.user_id as string);

    const { data: profile } = await admin.from('profiles').select('display_name').eq('id', uid).maybeSingle();
    // 'You' is the column default, not a name — "You ended your hub" would read
    // as if the partner had done it.
    const rawName = (profile?.display_name as string | undefined)?.trim();
    const leaverName = rawName && rawName !== 'You' ? rawName : 'Your partner';

    log('info', 'leave.start', { uid, coupleId, partners: partnerIds.length });

    await broadcastEnded(coupleId);
    const galleryFiles = await removeAll(admin, PUBLIC_BUCKET, `couples/${coupleId}`);

    const { error: deleteError } = await admin.from('couples').delete().eq('id', coupleId);
    if (deleteError) throw new Error(`delete hub: ${deleteError.message}`);

    await pushEnded(admin, partnerIds, leaverName);

    log('info', 'leave.done', { uid, coupleId, galleryFiles });
    return json({ ok: true });
  } catch (thrown) {
    // Retry-safe: files are re-listed, and the hub row is only deleted once.
    log('error', 'leave.failed', { uid, message: String(thrown) });
    return json({ error: 'We couldn’t end your hub just now. Please try again in a moment.' }, 500);
  }
});
