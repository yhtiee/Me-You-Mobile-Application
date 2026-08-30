/**
 * The AI relationship coach.
 *
 * This function exists for one reason above all others: it is the only place
 * the Gemini key can live. Anything prefixed `EXPO_PUBLIC_` is compiled into
 * the app bundle and readable by anyone who downloads it, so calling the model
 * from the device would publish the key. It is also where
 * `claim_coach_question()` is called, which is what makes the free-tier quota a
 * limit rather than a suggestion — a client that could call Gemini directly
 * could also skip the counter.
 *
 * Contract: POST { conversationId?, text, attachments? } -> SSE stream.
 *
 * Events are newline-delimited JSON on `data:` lines:
 *   { type: 'meta',  conversationId, userMessageId }
 *   { type: 'delta', text }
 *   { type: 'done',  messageId, stopReason }
 *   { type: 'error', message, code? }
 *
 * SSE rather than a single JSON reply because the client needs to render the
 * answer as it arrives and be able to stop it — and a stop that only discards a
 * response already paid for is not a stop.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BUCKET = 'coach-uploads';

/**
 * `gemini-2.5-flash` is gone — the API answers 404 with "no longer available to
 * new users". Do not put it back.
 *
 * Models whose ids are pinned on existing rows are honoured, except when they
 * are known-dead: see `RETIRED_MODELS`.
 */
const DEFAULT_MODEL = 'gemini-3.7-flash';

/** Pinned ids that no longer resolve. A conversation on one is silently moved. */
const RETIRED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'claude-opus-5',
]);

/**
 * Thinking off.
 *
 * Not a cost decision — a correctness one. Gemini 3.x reasons before answering
 * by default, and on a plain coaching question that took long enough to blow
 * the Edge Function's wall clock: the request came back 504 having produced no
 * text at all. With the budget at zero the same prompt answers in full. The
 * caveat is that "0" is a ceiling the model still edges past (a few hundred
 * thought tokens show up in usage), so this is "don't deliberate", not
 * "cannot think".
 */
const THINKING: Record<string, unknown> = { thinkingBudget: 0 };

/**
 * How much transcript gets replayed.
 *
 * Every turn resends the thread, so an unbounded history means a bill and a
 * latency that grow without limit on a conversation nobody thought to end. 40
 * messages is roughly twenty exchanges — well past where a coaching thread
 * stops referring to its own beginning.
 */
const MAX_HISTORY = 40;

const SYSTEM_PROMPT = `You are the Me&u relationship coach.

You are talking to one half of a couple, privately. Their partner cannot read
any of this, and you must never imply otherwise or suggest sharing the thread.

How to be useful here:
- Be warm and direct. Short paragraphs. No bullet-point lectures unless asked.
- Name the feeling before offering the fix. "That sounds lonely" earns the
  advice that follows it; advice on its own rarely lands.
- Prefer one concrete, low-effort suggestion over three abstract ones.
- Coach the person in front of you. You only ever hear one side, so do not
  diagnose the partner, assign blame, or speculate about their motives.
- When something sounds like abuse, coercion or danger, say so plainly and
  point toward real-world help. Do not coach someone into staying safe with
  better communication.
- You are not a therapist and should say so if asked to be one.

Keep replies under about 150 words unless the person asks for more.`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Attachment = { storagePath: string; mimeType: string; fileName?: string };
type Body = { conversationId?: string; text?: string; attachments?: Attachment[] };

/**
 * Structured logging.
 *
 * One JSON object per line, because the dashboard's log viewer lets you filter
 * on fields but not parse prose — and this CLI version has no `functions logs`
 * at all, so these are the only record of what happened. Every line carries
 * `rid`, a per-request id, so the entries for one message can be pulled out of
 * a stream of concurrent ones.
 *
 * Never log message text or attachment bytes. The whole premise of the coach is
 * that the transcript is private, and a log is a copy of whatever you put in it.
 */
function makeLog(rid: string) {
  return (level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) => {
    const line = JSON.stringify({ rid, level, event, ...data });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };
}

/** One `data:` frame. */
function sse(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function fail(message: string, status: number, code?: string, detail?: string): Response {
  // `detail` reaches the client on purpose. The generic "could not answer just
  // now" was accurate and useless — it hid a 404 saying the model had been
  // retired, which is precisely the sentence someone needs to fix it.
  return new Response(JSON.stringify({ error: message, code, detail }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Flattened text of a content-block array, for `preview` and for history. */
function flatten(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && typeof b === 'object' && (b as { type?: string }).type === 'text')
    .map((b) => (b as { text?: string }).text ?? '')
    .join('')
    .trim();
}

/** Base64 without blowing the stack on a 10MB file. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Turn stored content blocks into Gemini `parts`.
 *
 * Attachments are inlined as base64 rather than passed by URL: the bucket is
 * private, so a URL would have to be a signed one, and handing Google a
 * time-limited public link to a user's private screenshot is a worse trade than
 * the bandwidth.
 */
async function toParts(
  admin: SupabaseClient,
  content: unknown[]
): Promise<Record<string, unknown>[]> {
  const parts: Record<string, unknown>[] = [];

  for (const raw of content) {
    const block = raw as { type?: string; text?: string; storagePath?: string; mimeType?: string };

    if (block.type === 'text' && block.text) {
      parts.push({ text: block.text });
      continue;
    }

    if (block.type === 'file' && block.storagePath) {
      const { data, error } = await admin.storage.from(BUCKET).download(block.storagePath);
      // A missing attachment must not sink the whole turn — the rest of the
      // message is still worth answering.
      if (error || !data) {
        parts.push({ text: '[an attachment could not be read]' });
        continue;
      }
      parts.push({
        inline_data: {
          mime_type: block.mimeType ?? 'application/octet-stream',
          data: toBase64(new Uint8Array(await data.arrayBuffer())),
        },
      });
    }
  }

  return parts;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('Use POST.', 405);

  const rid = crypto.randomUUID().slice(0, 8);
  const log = makeLog(rid);
  const startedAt = Date.now();
  log('info', 'request.start');

  if (!GEMINI_KEY) {
    log('error', 'config.missing_key');
    // Explicit, because the alternative is a 500 that looks like the model is
    // down when the real answer is that the secret was never set.
    return fail('The coach is not configured. GEMINI_API_KEY is missing.', 503, 'no_key');
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail('Sign in to use the coach.', 401);

  // Two clients on purpose. `caller` runs as the user, so every read and write
  // below is still checked by the 0007 policies — the function never becomes a
  // way around RLS. `admin` exists only to read the private bucket, which the
  // user can also read but not from here without forwarding their session to
  // storage.
  const caller = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: auth } = await caller.auth.getUser();
  const user = auth?.user;
  if (!user) return fail('Your session ended. Log in again.', 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail('Malformed request.', 400);
  }

  const text = (body.text ?? '').trim();
  const attachments = body.attachments ?? [];
  if (!text && attachments.length === 0) return fail('Say something first.', 400);

  // ---------------------------------------------------------------------
  // Quota. Before any model call, and before the user's message is stored —
  // a refused turn should leave no trace but the dialog.
  // ---------------------------------------------------------------------
  const { data: claimed, error: claimError } = await caller.rpc('claim_coach_question');
  if (claimError) return fail('Could not check your daily allowance.', 500);
  if (claimed === false) {
    return fail('That’s today’s three questions.', 429, 'limit_reached');
  }

  // ---------------------------------------------------------------------
  // Conversation
  // ---------------------------------------------------------------------
  let conversationId = body.conversationId ?? null;

  if (!conversationId) {
    const { data: created, error } = await caller
      .from('coach_conversations')
      .insert({
        user_id: user.id,
        // Title is the opening line, trimmed. Good enough to find a thread
        // again, and replaced by nothing else until summarisation exists.
        title: text.slice(0, 60) || 'New conversation',
        model: DEFAULT_MODEL,
      })
      .select('id, model')
      .single();

    if (error || !created) return fail('Could not start that conversation.', 500);
    conversationId = created.id as string;
  }

  const { data: conversation } = await caller
    .from('coach_conversations')
    .select('model')
    .eq('id', conversationId)
    .single();

  /*
   * A pinned model is honoured unless it is known to be gone.
   *
   * Conversations created before this fix carry `gemini-2.5-flash`, which the
   * API now 404s as retired — so honouring the pin faithfully would leave those
   * threads permanently broken. The pin exists to stop a *silent* model swap
   * mid-thread; moving a thread off a model that no longer answers is not that.
   */
  const pinned = (conversation?.model as string) ?? DEFAULT_MODEL;
  const model = RETIRED_MODELS.has(pinned) ? DEFAULT_MODEL : pinned;

  if (model !== pinned) {
    log('warn', 'model.retired_pin_replaced', { pinned, model });
    // Write it back so the thread stops carrying a dead id.
    await caller.from('coach_conversations').update({ model }).eq('id', conversationId);
  }

  log('info', 'conversation.resolved', { conversationId, model, attachments: attachments.length });

  // ---------------------------------------------------------------------
  // Store the user's turn. `seq` is assigned by the trigger added in 0015.
  // ---------------------------------------------------------------------
  const userContent: Record<string, unknown>[] = [];
  if (text) userContent.push({ type: 'text', text });
  for (const a of attachments) {
    userContent.push({
      type: 'file',
      storagePath: a.storagePath,
      mimeType: a.mimeType,
      fileName: a.fileName ?? null,
    });
  }

  const { data: userMessage, error: userError } = await caller
    .from('coach_messages')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: userContent,
      preview: text.slice(0, 280),
      status: 'complete',
    })
    .select('id')
    .single();

  if (userError || !userMessage) return fail('Could not save your message.', 500);

  // Link any attachment rows to the message now that it exists.
  if (attachments.length > 0) {
    await caller
      .from('coach_attachments')
      .update({ message_id: userMessage.id })
      .in(
        'storage_path',
        attachments.map((a) => a.storagePath)
      );
  }

  // ---------------------------------------------------------------------
  // Build the replay
  // ---------------------------------------------------------------------
  const { data: history } = await caller
    .from('coach_messages')
    .select('role, content, status')
    .eq('conversation_id', conversationId)
    .order('seq', { ascending: true })
    .limit(MAX_HISTORY);

  const contents: Record<string, unknown>[] = [];
  for (const row of history ?? []) {
    // Failed and in-flight turns are skipped: replaying a half-written or
    // errored assistant message teaches the model to produce more of them.
    if (row.status !== 'complete') continue;
    const parts = await toParts(admin, (row.content ?? []) as unknown[]);
    if (parts.length === 0) continue;
    contents.push({ role: row.role === 'assistant' ? 'model' : 'user', parts });
  }

  // ---------------------------------------------------------------------
  // Stream
  // ---------------------------------------------------------------------
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024,
          thinkingConfig: THINKING,
        },
      }),
      // Propagates the client hanging up, so an aborted reply stops costing
      // money the moment the user taps stop.
      signal: req.signal,
    }
  );

  if (!upstream.ok || !upstream.body) {
    const raw = await upstream.text().catch(() => '');
    // Google puts the useful sentence in `error.message` — "no longer available
    // to new users", "experiencing high demand". Pull it out rather than
    // shipping a wall of JSON to the client.
    let detail = raw.slice(0, 300);
    try {
      detail = JSON.parse(raw)?.error?.message ?? detail;
    } catch {
      /* not JSON; the slice above stands */
    }

    log('error', 'gemini.failed', { status: upstream.status, model, detail });

    await caller.from('coach_messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'assistant',
      content: [],
      status: 'failed',
      error: `upstream ${upstream.status}: ${detail}`.slice(0, 500),
      model,
    });

    return fail(
      upstream.status === 503
        ? 'The coach is busy right now. Try again in a moment.'
        : 'The coach could not answer just now.',
      502,
      'upstream',
      detail
    );
  }

  log('info', 'gemini.streaming', { model, turns: contents.length });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sse({ type: 'meta', conversationId, userMessageId: userMessage.id }));

      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();

      let buffered = '';
      let answer = '';
      let stopReason: string | null = null;
      let usage: Record<string, number> = {};

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffered += decoder.decode(value, { stream: true });
          const lines = buffered.split('\n');
          // The last element may be a partial line; keep it for the next chunk.
          buffered = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
              const chunk = JSON.parse(payload);
              const candidate = chunk.candidates?.[0];

              for (const part of candidate?.content?.parts ?? []) {
                if (typeof part.text === 'string' && part.text) {
                  answer += part.text;
                  controller.enqueue(sse({ type: 'delta', text: part.text }));
                }
              }

              if (candidate?.finishReason) stopReason = candidate.finishReason;

              if (chunk.usageMetadata) {
                usage = {
                  input_tokens: chunk.usageMetadata.promptTokenCount ?? 0,
                  output_tokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
                  cache_read_input_tokens: chunk.usageMetadata.cachedContentTokenCount ?? 0,
                };
              }
            } catch {
              // A frame we cannot parse is not a reason to drop the stream.
            }
          }
        }
      } catch (thrown) {
        // The common case here is the client aborting, which is not an error.
        if (req.signal.aborted) log('info', 'stream.aborted_by_client');
        else log('error', 'stream.failed', { message: String(thrown) });
      }

      /*
       * Persist whatever arrived, even a partial answer.
       *
       * A cancelled reply is still the best record of what was said — throwing
       * it away leaves the user looking at text that vanishes, and leaves the
       * next turn replaying a thread with a question and no answer.
       */
      const aborted = req.signal.aborted;
      const { data: saved } = await caller
        .from('coach_messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: answer ? [{ type: 'text', text: answer }] : [],
          preview: answer.slice(0, 280),
          status: answer ? 'complete' : 'failed',
          stop_reason: aborted ? 'cancelled' : stopReason,
          model,
          ...usage,
        })
        .select('id')
        .single();

      await caller
        .from('coach_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      log('info', 'request.done', {
        ms: Date.now() - startedAt,
        chars: answer.length,
        stopReason: aborted ? 'cancelled' : stopReason,
        ...usage,
      });

      // An empty answer with a clean finish is the thinking-budget failure mode
      // — worth its own line, because it looks identical to a refusal on the
      // client and is not one.
      if (!answer && !aborted) {
        log('warn', 'gemini.empty_answer', { stopReason, ...usage });
      }

      controller.enqueue(
        sse({
          type: 'done',
          messageId: saved?.id ?? null,
          stopReason: aborted ? 'cancelled' : stopReason,
        })
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});
