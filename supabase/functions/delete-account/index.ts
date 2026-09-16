/**
 * Deletes the caller's account. Nobody else's, ever.
 *
 * Apple (5.1.1(v)) and Google Play both require an in-app way to delete an
 * account, and "delete" has to mean the data, not a flag. Removing an auth user
 * needs the service role, which can never ship in the app, so this is the only
 * place it can happen.
 *
 * Contract: POST (no body) with the user's session -> { ok: true } | { error }.
 *
 * What goes, in order:
 *
 *   1. Files, because storage does not cascade from Postgres:
 *      - the avatar folder `<uid>/` in the public bucket;
 *      - everything under `<uid>/` in `coach-uploads`;
 *      - a hub's gallery folder `couples/<id>/`, but only for hubs nobody else
 *        is still in. A partner who stays keeps the photos, exactly as the
 *        website's deletion page promises.
 *   2. Hubs the caller is the last active member of. Deleting the couple row
 *      cascades every shared table.
 *   3. The auth user. `profiles` cascades from it, and every per-user table
 *      cascades or nulls out from `profiles` (audited when this was written:
 *      each FK to `profiles` is `on delete cascade` or `on delete set null`).
 *
 * Order matters: files first, because once the rows are gone nothing records
 * which objects belonged to whom.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/** Must match migration 0010 and `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET`. */
const PUBLIC_BUCKET = Deno.env.get('AVATAR_BUCKET') ?? 'me&u';
const COACH_BUCKET = 'coach-uploads';

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

/** Never log names, emails or file names — only ids and counts. */
function log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Every object under a prefix, recursively.
 *
 * `list()` returns one level: files have an `id`, folders don't. Paged, because
 * a long-lived gallery can outgrow a single page.
 */
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
  // `remove()` takes a bounded batch; chunk well under the limit.
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
  }
  return paths.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in to delete your account.' }, 401);

  // The user is taken from the session and nowhere else. There is no body to
  // read, so there is no way to name somebody else's account.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: auth } = await caller.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return json({ error: 'Your session ended. Log in again, then try once more.' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  log('info', 'delete.start', { uid });

  try {
    // Every hub this user was ever in, and who else is still active there.
    const { data: memberships, error: memberError } = await admin
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', uid);
    if (memberError) throw new Error(`memberships: ${memberError.message}`);

    const coupleIds = [...new Set((memberships ?? []).map((m) => m.couple_id as string))];
    const orphaned: string[] = [];

    for (const coupleId of coupleIds) {
      const { count, error } = await admin
        .from('couple_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('couple_id', coupleId)
        .neq('user_id', uid)
        .is('left_at', null);
      if (error) throw new Error(`others in hub: ${error.message}`);
      if (!count) orphaned.push(coupleId);
    }

    // 1. Files.
    const avatars = await removeAll(admin, PUBLIC_BUCKET, uid);
    const coachFiles = await removeAll(admin, COACH_BUCKET, uid);
    let galleryFiles = 0;
    for (const coupleId of orphaned) {
      galleryFiles += await removeAll(admin, PUBLIC_BUCKET, `couples/${coupleId}`);
    }

    // 2. Hubs with nobody left in them.
    if (orphaned.length) {
      const { error } = await admin.from('couples').delete().in('id', orphaned);
      if (error) throw new Error(`delete hubs: ${error.message}`);
    }

    // 3. The account itself. Everything keyed to the profile goes with it.
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw new Error(`delete user: ${deleteError.message}`);

    log('info', 'delete.done', {
      uid,
      hubsDeleted: orphaned.length,
      hubsLeft: coupleIds.length - orphaned.length,
      avatars,
      coachFiles,
      galleryFiles,
    });
    return json({ ok: true });
  } catch (thrown) {
    // Safe to retry: every step above is idempotent, and nothing is removed
    // from the auth user until the files and hubs are already gone.
    log('error', 'delete.failed', { uid, message: String(thrown) });
    return json({ error: 'We couldn’t delete your account just now. Please try again in a moment.' }, 500);
  }
});
