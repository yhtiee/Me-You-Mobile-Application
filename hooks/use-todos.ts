import { useCallback } from 'react';

import { useAsyncData } from '@/hooks/use-async-data';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import {
  addTodo,
  clearDoneTodos,
  deleteTodo,
  fetchTodos,
  setTodoDone,
} from '@/lib/todos';
import type { Todo } from '@/types/domain';

/**
 * Your own rows, but you may be holding two phones — the realtime channel
 * filters `todos` on `user_id`, so a reminder added on one device appears on
 * the other.
 */
const TODO_TABLES = ['todos'] as const;

const EMPTY: Todo[] = [];

/** Private quick-actions widget — only ever visible to its creator. */
export function useTodos() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw new Error('Your session ended. Log in again to continue.');
    return fetchTodos();
  }, [userId]);

  const { data, error, loading, refetch, setData } = useAsyncData(
    userId ? load : null,
    TODO_TABLES
  );

  // A module-level constant, not a fresh `[]` per render: this value is a
  // dependency of the callbacks below, and a new array each time would rebuild
  // all of them on every render.
  const todos = data ?? EMPTY;

  /** Optimistic, with a rollback — the same contract as the other write paths. */
  const mutate = useCallback(
    (next: Todo[], run: () => Promise<void>) => {
      if (!data) return;
      const previous = data;
      setData(next);
      void run().catch((thrown: unknown) => {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'That didn’t save.');
      });
    },
    [data, setData, toast]
  );

  const toggle = useCallback(
    (todo: Todo) => {
      mutate(
        todos.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
        () => setTodoDone(todo.id, !todo.done)
      );
    },
    [todos, mutate]
  );

  const remove = useCallback(
    (todo: Todo) => {
      mutate(
        todos.filter((t) => t.id !== todo.id),
        () => deleteTodo(todo.id)
      );
    },
    [todos, mutate]
  );

  const clearDone = useCallback(() => {
    mutate(
      todos.filter((t) => !t.done),
      () => clearDoneTodos()
    );
  }, [todos, mutate]);

  /**
   * Not optimistic, unlike the others: the row's id is assigned by the database,
   * so an optimistic insert would need a fake one and a reconciliation step. The
   * write is a single round trip and the field clears immediately, which is the
   * part that has to feel instant.
   */
  const add = useCallback(
    async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed || !userId) return false;

      try {
        await addTodo({ userId, coupleId, label: trimmed });
        refetch();
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t add that.');
        return false;
      }
    },
    [userId, coupleId, refetch, toast]
  );

  return {
    todos,
    open: todos.filter((t) => !t.done),
    done: todos.filter((t) => t.done),
    loading,
    error,
    refetch,
    add,
    toggle,
    remove,
    clearDone,
  };
}
