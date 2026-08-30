import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import type { CoachConversation, CoachMessage, CoachAttachment } from '@/types/domain';

/**
 * The coach, client side.
 *
 * The model call itself is not here and must not be — it lives in the
 * `coach` Edge Function, which is the only place the Gemini key can sit without
 * being compiled into the app bundle. This file talks to that function and to
 * the transcript tables around it.
 */

const BUCKET = 'coach-uploads';

/** 10MB, mirroring the bucket limit and the `coach_attachments` check. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_DOC_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
] as const;

function toMessage(error: { message: string }, what: string): Error {
  if (/network|fetch|timeout/i.test(error.message)) {
    return new Error('You’re offline. Check your connection and try again.');
  }
  return new Error(`Couldn’t ${what}. ${error.message}`);
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function fetchConversations(): Promise<CoachConversation[]> {
  const { data, error } = await supabase
    .from('coach_conversations')
    .select('id, title, last_message_at, created_at')
    .is('archived_at', null)
    // Newest activity first, falling back to creation for a thread that was
    // started and never sent to.
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw toMessage(error, 'load your conversations');

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string | null) ?? 'New conversation',
    lastMessageAt: (row.last_message_at as string | null) ?? (row.created_at as string),
  }));
}

/**
 * Archive rather than delete.
 *
 * The row carries the token accounting for every turn in it, and a user tidying
 * their thread list should not silently destroy the only record of what the
 * coach cost. `archived_at` drops it out of every query the app makes.
 */
export async function archiveConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('coach_conversations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) throw toMessage(error, 'remove that conversation');
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

type ContentBlock = {
  type?: string;
  text?: string;
  storagePath?: string;
  mimeType?: string;
  fileName?: string | null;
};

export async function fetchMessages(conversationId: string): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('id, role, content, status, stop_reason, created_at')
    .eq('conversation_id', conversationId)
    .order('seq', { ascending: true });

  if (error) throw toMessage(error, 'load this conversation');

  return (data ?? []).map((row) => {
    const blocks = (row.content ?? []) as ContentBlock[];

    return {
      id: row.id as string,
      // The UI speaks you/coach; the wire speaks user/assistant. One mapping,
      // here at the edge, rather than a translated transcript per request.
      from: row.role === 'assistant' ? ('coach' as const) : ('you' as const),
      text: blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
        .trim(),
      attachments: blocks
        .filter((b) => b.type === 'file' && b.storagePath)
        .map((b) => ({
          storagePath: b.storagePath!,
          mimeType: b.mimeType ?? 'application/octet-stream',
          fileName: b.fileName ?? null,
        })),
      status: row.status as CoachMessage['status'],
      stopReason: (row.stop_reason as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/**
 * Upload one file and record it.
 *
 * The bytes are read here and handed to storage directly, rather than passing
 * the `file://` URI to a FormData. React Native's `fetch` accepts `{ uri }` and
 * supabase-js accepts a Blob, but on Android a `content://` URI from the
 * document picker resolves to zero bytes through both — the upload "succeeds"
 * and the object is empty. Reading it ourselves is the only version that works
 * on both platforms.
 *
 * `File` is SDK 54's class API; `readAsStringAsync`/`EncodingType` moved to
 * `expo-file-system/legacy`. Worth using the new one for more than tidiness:
 * `bytes()` returns a `Uint8Array` straight out, where the legacy path had to
 * go via a base64 string and back, holding two copies of a 10MB file in memory.
 */
export async function uploadAttachment(input: {
  userId: string;
  conversationId: string | null;
  uri: string;
  mimeType: string;
  fileName: string;
}): Promise<CoachAttachment> {
  const file = new File(input.uri);
  if (!file.exists) throw new Error('That file has gone missing.');

  const size = file.size ?? 0;
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new Error('That file is over 10MB. Try a smaller one.');
  }

  const bytes = await file.bytes();

  // First segment is the user id — that is the key the 0015 storage policies
  // check. `pending` groups files chosen before the conversation exists.
  const folder = input.conversationId ?? 'pending';
  const extension = input.fileName.includes('.') ? input.fileName.split('.').pop() : 'bin';
  const storagePath = `${input.userId}/${folder}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: input.mimeType, upsert: false });

  if (error) throw toMessage(error, 'upload that');

  const { error: rowError } = await supabase.from('coach_attachments').insert({
    conversation_id: input.conversationId,
    user_id: input.userId,
    storage_path: storagePath,
    mime_type: input.mimeType,
    size_bytes: size,
    file_name: input.fileName,
  });

  // The object is already up; a failed row means it is unreferenced, which the
  // upload path can survive. Do not fail the user's message over it.
  if (rowError) console.warn('coach attachment row failed', rowError.message);

  return {
    storagePath,
    mimeType: input.mimeType,
    fileName: input.fileName,
    localUri: input.uri,
  };
}

/**
 * A viewable URL for a stored attachment.
 *
 * Signed, and short-lived, because the bucket is private — which is the whole
 * point of it being a separate bucket from the public-read avatar one.
 */
export async function signAttachment(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteAttachment(storagePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  await supabase.from('coach_attachments').delete().eq('storage_path', storagePath);
}

// ---------------------------------------------------------------------------
// Quota
// ---------------------------------------------------------------------------

export async function fetchQuota(): Promise<{
  used: number;
  allowance: number;
  isPremium: boolean;
}> {
  const { data, error } = await supabase.rpc('coach_quota');
  if (error) throw toMessage(error, 'check your allowance');

  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    used: Number(row.used ?? 0),
    allowance: Number(row.allowance ?? 3),
    isPremium: Boolean(row.is_premium),
  };
}

// ---------------------------------------------------------------------------
// Asking
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: 'meta'; conversationId: string; userMessageId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string | null; stopReason: string | null }
  | { type: 'error'; message: string; code?: string };

/**
 * Ask the coach, streaming the answer back.
 *
 * `expo/fetch` rather than the global. React Native's built-in fetch is backed
 * by XHR and has no readable stream, so `response.body` is null and the only
 * way to see a reply is to wait for all of it — which would make both the
 * live typing and the stop button impossible. Expo's WinterCG fetch is the one
 * that streams.
 *
 * The caller owns the `AbortSignal`; aborting it propagates all the way to the
 * Gemini request inside the Edge Function, so stopping actually stops the
 * generation rather than just hiding it.
 */
export async function askCoach(input: {
  conversationId: string | null;
  text: string;
  attachments: CoachAttachment[];
  signal: AbortSignal;
  onEvent: (event: StreamEvent) => void;
}): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Your session ended. Log in again.');

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/coach`;

  const response = await expoFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId: input.conversationId,
      text: input.text,
      attachments: input.attachments.map((a) => ({
        storagePath: a.storagePath,
        mimeType: a.mimeType,
        fileName: a.fileName,
      })),
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    input.onEvent({
      type: 'error',
      message: detail?.error ?? 'The coach could not answer just now.',
      code: detail?.code,
    });
    return;
  }

  if (!response.body) {
    input.onEvent({ type: 'error', message: 'The coach sent nothing back.' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    // Keep the trailing partial line for the next chunk.
    buffered = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        input.onEvent(JSON.parse(payload) as StreamEvent);
      } catch {
        // A frame we cannot parse is not a reason to drop the stream.
      }
    }
  }
}
