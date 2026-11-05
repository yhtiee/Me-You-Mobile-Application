/**
 * Sends the welcome email, once per account.
 *
 * Called by the app straight after sign-up, with the new session. The address
 * comes from that session and nowhere else, so this can only ever mail the
 * caller — there is no way to point it at somebody else's inbox.
 *
 * Once means once: `email_sends` has a (user_id, kind) primary key, and the row
 * is claimed *before* sending. A retry, a double tap, or an older build calling
 * it on every launch all find the row and stop.
 *
 * Contract: POST (no body) with the user's session -> { ok: true, sent: boolean }.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { sendEmail, welcomeEmail } from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in first.' }, 401);

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: auth } = await caller.auth.getUser();
  const user = auth?.user;
  if (!user?.email) return json({ error: 'Your session ended.' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Claim first. A conflict means it was already sent (or is being sent).
  const { error: claimError } = await admin.from('email_sends').insert({ user_id: user.id, kind: 'welcome' });
  if (claimError) {
    if (claimError.code === '23505') return json({ ok: true, sent: false });
    console.error(JSON.stringify({ level: 'error', event: 'welcome.claim_failed', message: claimError.message }));
    return json({ error: 'Couldn’t send that just now.' }, 500);
  }

  const firstName = (user.user_metadata?.first_name as string | undefined) ?? null;
  const sent = await sendEmail({
    to: user.email,
    email: welcomeEmail({ name: firstName }),
    idempotencyKey: `welcome-${user.id}`,
    tag: 'welcome',
  });

  // Release the claim if Resend refused, so the next call can try again.
  if (!sent) await admin.from('email_sends').delete().eq('user_id', user.id).eq('kind', 'welcome');

  return json({ ok: true, sent });
});
