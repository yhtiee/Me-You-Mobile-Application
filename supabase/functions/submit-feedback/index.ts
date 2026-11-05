/**
 * Files feedback or a safety report, and makes sure a person hears about it.
 *
 * Before this, the Feedback screen wrote straight to `public.feedback` and the
 * row just sat there until somebody opened the dashboard. The child safety page
 * promises review within 24 hours, which needs the report to *arrive*
 * somewhere. So:
 *
 *   1. Insert the row (service role, user taken from the session).
 *   2. Email it to SUPPORT_INBOX, with reply-to set to the sender, so answering
 *      is just hitting Reply.
 *   3. For safety reports, send the reporter an acknowledgement.
 *
 * Emails are best effort; the row is the record. If the insert succeeds the
 * call succeeds, even if Resend is down.
 *
 * The client keeps the direct insert as a fallback for when this function
 * can't be reached at all, so a report is never lost to an outage here.
 *
 * Contract: POST { kind, message, contact?, appVersion?, platform? }
 *   -> { ok: true } | { error }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  feedbackToTeamEmail,
  safetyReportReceivedEmail,
  sendEmail,
  SUPPORT_INBOX,
} from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/** Generous for a person, tight for a script. Safety reports are never limited. */
const MAX_PER_HOUR = 10;

const KINDS = new Set(['feedback', 'bug', 'safety']);
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in to send feedback.' }, 401);

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: auth } = await caller.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: 'Your session ended. Log in again to continue.' }, 401);

  let body: { kind?: string; message?: string; contact?: string | null; appVersion?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }

  const kind = body.kind ?? '';
  const message = (body.message ?? '').trim();
  const contact = body.contact?.trim() || null;
  if (!KINDS.has(kind)) return json({ error: 'Pick what kind of message this is.' }, 400);
  if (!message || message.length > 4000) return json({ error: 'Write between 1 and 4000 characters.' }, 400);
  if (contact && contact.length > 320) return json({ error: 'That contact is too long.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    if (kind !== 'safety') {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', hourAgo);
      if ((count ?? 0) >= MAX_PER_HOUR) {
        return json({ error: 'You’ve sent a lot in the last hour. Try again a little later.' }, 429);
      }
    }

    const { data: row, error: insertError } = await admin
      .from('feedback')
      .insert({
        user_id: user.id,
        kind,
        message,
        contact,
        app_version: body.appVersion?.slice(0, 40) ?? null,
        platform: body.platform?.slice(0, 20) ?? null,
      })
      .select('id')
      .single();
    if (insertError) throw new Error(`insert: ${insertError.message}`);

    const feedbackId = row.id as string;
    log('info', 'feedback.saved', { feedbackId, kind });

    // Reply goes to the address they asked to be answered on, if it is one.
    const replyTo = contact && EMAIL_SHAPE.test(contact) ? contact : (user.email ?? undefined);

    await sendEmail({
      to: SUPPORT_INBOX,
      replyTo,
      email: feedbackToTeamEmail({
        kind: kind as 'feedback' | 'bug' | 'safety',
        message,
        feedbackId,
        userId: user.id,
        accountEmail: user.email ?? null,
        contact,
        appVersion: body.appVersion ?? null,
        platform: body.platform ?? null,
      }),
      idempotencyKey: `feedback-team-${feedbackId}`,
      tag: kind === 'safety' ? 'safety_report_team' : 'feedback_team',
    });

    if (kind === 'safety' && user.email) {
      const { data: profile } = await admin
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .maybeSingle();
      await sendEmail({
        to: user.email,
        email: safetyReportReceivedEmail({ name: (profile?.first_name as string | null) ?? null }),
        idempotencyKey: `feedback-ack-${feedbackId}`,
        tag: 'safety_report_ack',
      });
    }

    return json({ ok: true });
  } catch (thrown) {
    log('error', 'feedback.failed', { kind, message: String(thrown) });
    return json({ error: 'We couldn’t send that just now. Please try again.' }, 500);
  }
});
