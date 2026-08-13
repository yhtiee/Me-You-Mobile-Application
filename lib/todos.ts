import { supabase } from '@/lib/supabase';
import type { Todo } from '@/types/domain';

/**
 * Private reminders — the one list in the app the other person never sees.
 *
 * The policy is `user_id = auth.uid()` for every operation, so nothing here
 * passes a couple id as a *filter*: an unscoped select already returns exactly
 * one person's rows. `couple_id` is written on insert anyway, because the column
 * exists to survive an unpair (`on delete set null`) and a row that never
 * carried it cannot be attributed later.
 */

function toMessage(error: { message: string }, what: string): Error {
  if (/network|fetch|timeout/i.test(error.message)) {
    return new Error('You’re offline. Check your connection and try again.');
  }
  return new Error(`Couldn’t ${what}. ${error.message}`);
}

export async function fetchTodos(): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('id, label, done')
    // Undone first, then oldest first inside each group — the order the screen
    // renders, done server-side so two devices agree on it.
    .order('done', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw toMessage(error, 'load your reminders');
  return (data ?? []) as Todo[];
}

export async function addTodo(input: {
  userId: string;
  coupleId: string | null;
  label: string;
}): Promise<void> {
  const { error } = await supabase.from('todos').insert({
    user_id: input.userId,
    couple_id: input.coupleId,
    label: input.label,
  });

  if (error) throw toMessage(error, 'add that');
}

export async function setTodoDone(todoId: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('todos').update({ done }).eq('id', todoId);
  if (error) throw toMessage(error, 'update that');
}

export async function deleteTodo(todoId: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', todoId);
  if (error) throw toMessage(error, 'delete that');
}

/**
 * Bin everything already ticked.
 *
 * A real delete, not an archive flag. These are throwaway reminders — "book the
 * restaurant" has no value the day after — and a private list that only ever
 * grows becomes a list nobody opens.
 */
export async function clearDoneTodos(): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('done', true);
  if (error) throw toMessage(error, 'clear those');
}
