/**
 * Forgot password, handled here rather than by Supabase's recovery email.
 *
 * Why custom: Supabase's flow mails a magic link that has to land back in the
 * app through a deep link, which needs universal links / app links set up and
 * breaks in Expo Go. A six-digit code typed into the app has none of that, and
 * the email it rides on is ours (Resend, our template, our domain).
 *
 * Called signed out, so `verify_jwt = false` (see config.toml). Everything that
 * makes that safe is in this file:
 *
 *   - `request` answers the same way whether or not the address has an
 *     account, so it can't be used to find out who uses Me&u.
 *   - Codes are stored as an HMAC, expire after 15 minutes, work once, and
 *     allow five wrong guesses before they're dead.
 *   - Requesting a new code kills the old ones, and an account can be sent at
 *     most five codes an hour, one a minute.
 *
 * Contract:
 *   POST { action: 'request', email }                 -> { ok: true }
 *   POST { action: 'confirm', email, code, password } -> { ok: true }
 *                                                      | { error, field? }
 *
 * After `confirm` succeeds the app signs in with the new password, then signs
 * out every other session (see `resetPassword` in AuthProvider).
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { passwordChangedEmail, passwordResetCodeEmail, sendEmail } from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * The HMAC key for stored codes. A dedicated secret if one is set; otherwise
 * the service role key, which is already secret and already here. Rotating
 * either only invalidates codes issued in the last 15 minutes.
 */
const CODE_SECRET = Deno.env.get('RESET_CODE_SECRET') ?? SERVICE_ROLE;

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/** Must match PASSWORD_MIN_LENGTH in utils/validation.ts. */
const PASSWORD_MIN_LENGTH = 8;

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

/** Ids only — never the address or the code. */
function log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Uniform over 000000–999999: rejection-sample so no digit is favoured. */
function generateCode(): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 1_000_000).padStart(6, '0');
  }
}

let hmacKey: CryptoKey | null = null;

/** Bound to the account, so a code hash is useless against any other user. */
async function hashCode(userId: string, code: string): Promise<string> {
  hmacKey ??= await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(CODE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`${userId}:${code}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two hex digests without short-circuiting on the first difference. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function userIdFor(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await admin.rpc('auth_user_id_by_email', { p_email: email });
  if (error) throw new Error(`lookup: ${error.message}`);
  return (data as string | null) ?? null;
}

async function displayName(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('display_name, first_name').eq('id', userId).maybeSingle();
  return (data?.first_name as string | null) ?? (data?.display_name as string | null) ?? null;
}

async function handleRequest(admin: SupabaseClient, email: string): Promise<Response> {
  const userId = await userIdFor(admin, email);

  // Same answer either way. The work below is skipped, not reported.
  if (!userId) {
    log('info', 'reset.request.no_account');
    return json({ ok: true });
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from('password_reset_codes')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', hourAgo)
    .order('created_at', { ascending: false });
  if (recentError) throw new Error(`recent: ${recentError.message}`);

  if ((recent?.length ?? 0) >= MAX_CODES_PER_HOUR) {
    log('warn', 'reset.request.hourly_limit', { userId });
    return json({ ok: true });
  }
  const last = recent?.[0]?.created_at as string | undefined;
  if (last && Date.now() - Date.parse(last) < RESEND_COOLDOWN_SECONDS * 1000) {
    log('info', 'reset.request.cooldown', { userId });
    return json({ ok: true });
  }

  // Only the newest code is ever valid.
  const now = new Date().toISOString();
  const { error: retireError } = await admin
    .from('password_reset_codes')
    .update({ used_at: now })
    .eq('user_id', userId)
    .is('used_at', null);
  if (retireError) throw new Error(`retire: ${retireError.message}`);

  const code = generateCode();
  const { error: insertError } = await admin.from('password_reset_codes').insert({
    user_id: userId,
    code_hash: await hashCode(userId, code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (insertError) throw new Error(`insert: ${insertError.message}`);

  const sent = await sendEmail({
    to: email,
    email: passwordResetCodeEmail({ name: await displayName(admin, userId), code, minutes: CODE_TTL_MINUTES }),
    tag: 'password_reset_code',
  });
  log(sent ? 'info' : 'error', 'reset.request.done', { userId, sent });

  return json({ ok: true });
}

async function handleConfirm(
  admin: SupabaseClient,
  email: string,
  code: string,
  password: string
): Promise<Response> {
  if (!/^\d{6}$/.test(code)) {
    return json({ error: 'Enter the 6-digit code from the email.', field: 'code' }, 400);
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return json({ error: `At least ${PASSWORD_MIN_LENGTH} characters`, field: 'password' }, 400);
  }

  const invalid = json({ error: 'That code isn’t right, or it has expired.', field: 'code' }, 400);

  const userId = await userIdFor(admin, email);
  if (!userId) return invalid;

  const { data: row, error } = await admin
    .from('password_reset_codes')
    .select('id, code_hash, attempts, expires_at')
    .eq('user_id', userId)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`code: ${error.message}`);

  if (!row || Date.parse(row.expires_at as string) < Date.now()) return invalid;

  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    return json({ error: 'Too many wrong tries. Ask for a new code.', field: 'code' }, 400);
  }

  const matches = safeEqual(await hashCode(userId, code), row.code_hash as string);
  if (!matches) {
    await admin
      .from('password_reset_codes')
      .update({ attempts: (row.attempts as number) + 1 })
      .eq('id', row.id);
    log('info', 'reset.confirm.wrong_code', { userId, attempts: (row.attempts as number) + 1 });
    return invalid;
  }

  /*
   * Burn the code before changing the password, and only if nobody else
   * burned it first. Two simultaneous confirms with the right code would
   * otherwise both succeed; with `.is('used_at', null)` on the update, exactly
   * one of them gets the row back.
   */
  const { data: claimed, error: claimError } = await admin
    .from('password_reset_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('used_at', null)
    .select('id');
  if (claimError) throw new Error(`claim: ${claimError.message}`);
  if (!claimed?.length) return invalid;

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateError) {
    // Nothing changed, so hand the code back: the person fixes the password and
    // submits again without waiting for another email. GoTrue's own rules
    // (a leaked-password check, if enabled) are reported against the field.
    await admin.from('password_reset_codes').update({ used_at: null }).eq('id', row.id);
    log('warn', 'reset.confirm.update_failed', { userId, message: updateError.message });
    const isPasswordRule = /password/i.test(updateError.message);
    return json(
      isPasswordRule
        ? { error: updateError.message, field: 'password' }
        : { error: 'We couldn’t change your password just now. Please try again.' },
      isPasswordRule ? 400 : 500
    );
  }

  log('info', 'reset.confirm.done', { userId });

  await sendEmail({
    to: email,
    email: passwordChangedEmail({ name: await displayName(admin, userId) }),
    idempotencyKey: `password-changed-${row.id}`,
    tag: 'password_changed',
  });

  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let body: { action?: string; email?: string; code?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email) || email.length > 320) {
    return json({ error: 'Enter a valid email address', field: 'email' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    if (body.action === 'request') return await handleRequest(admin, email);
    if (body.action === 'confirm') {
      return await handleConfirm(admin, email, (body.code ?? '').trim(), body.password ?? '');
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (thrown) {
    log('error', 'reset.failed', { action: body.action, message: String(thrown) });
    return json({ error: 'Something went wrong on our side. Please try again in a moment.' }, 500);
  }
});
