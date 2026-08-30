-- ============================================================================
-- 0016 · The coach's model, corrected
--
-- `0015` set the default to `gemini-2.5-flash`. That model answers 404:
--
--   "This model models/gemini-2.5-flash is no longer available to new users.
--    Please update your code to use models/gemini-3.6-flash for the latest
--    features and improvements."
--
-- Which is why every message came back as "the coach could not answer just
-- now". Verified against the live API with the project's own key.
--
-- Re-runnable.
-- ============================================================================

alter table public.coach_conversations
  alter column model set default 'gemini-3.7-flash';

/*
 * Move existing threads off ids that no longer resolve.
 *
 * `model` is pinned per conversation so history is never silently replayed to a
 * different model than produced it — but that guarantee is about *quality*, and
 * it cannot be worth more than the thread answering at all. A conversation
 * pinned to a retired id is broken for ever otherwise.
 *
 * Listed explicitly rather than "anything that isn't the default", so a
 * deliberate pin to a working model is left alone. `claude-opus-5` is in here
 * because it was 0005's default, from before the coach ran on Gemini.
 */
update public.coach_conversations
set model = 'gemini-3.7-flash'
where model in (
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'claude-opus-5'
);

/*
 * Clear the failed assistant turns those threads collected.
 *
 * They carry no content — the upstream call never produced any — and the Edge
 * Function already skips non-`complete` rows when building the replay. Leaving
 * them would only put "that didn't send" bubbles in the transcript for a fault
 * that has been fixed. The user's own messages are untouched.
 */
delete from public.coach_messages
where role = 'assistant'
  and status = 'failed'
  and (content is null or jsonb_array_length(content) = 0);
