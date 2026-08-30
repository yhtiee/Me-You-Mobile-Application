import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import {
  archiveConversation,
  askCoach,
  deleteAttachment,
  fetchConversations,
  fetchMessages,
  fetchQuota,
  uploadAttachment,
} from '@/lib/coach';
import { COACH_SUGGESTIONS } from '@/constants/coach';
import type { CoachAttachment, CoachConversation, CoachMessage } from '@/types/domain';

/**
 * The AI relationship coach.
 *
 * The reply arrives as a stream, so this hook holds two kinds of state at once:
 * `thread`, which is what the database says, and `streaming`, which is the
 * answer currently arriving. They are kept apart deliberately — merging the
 * partial reply into `thread` would mean a refetch could overwrite it mid-word,
 * and the "stop" button would have nothing distinct to point at.
 */

const CONVERSATION_TABLES = ['coach_conversations'] as const;

const NO_CONVERSATIONS: CoachConversation[] = [];
const NO_MESSAGES: CoachMessage[] = [];

export type PendingAttachment = CoachAttachment & { uploading?: boolean };

export function useCoach() {
  const { user } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  /** Null means "a new conversation the server has not created yet". */
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [thread, setThread] = useState<CoachMessage[]>(NO_MESSAGES);
  const [threadLoading, setThreadLoading] = useState(false);

  const [streamingText, setStreamingText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  /** Lives in a ref because the stop button must reach the *current* request. */
  const abortRef = useRef<AbortController | null>(null);

  // -----------------------------------------------------------------------
  // Conversation list + quota
  // -----------------------------------------------------------------------

  const loadConversations = useCallback(async () => {
    if (!userId) throw new Error('Your session ended. Log in again.');
    return fetchConversations();
  }, [userId]);

  const {
    data: conversationData,
    loading: conversationsLoading,
    refetch: refetchConversations,
  } = useAsyncData(userId ? loadConversations : null, CONVERSATION_TABLES);

  const loadQuota = useCallback(async () => {
    if (!userId) throw new Error('Your session ended. Log in again.');
    return fetchQuota();
  }, [userId]);

  const { data: quota, refetch: refetchQuota } = useAsyncData(userId ? loadQuota : null);

  const conversations = conversationData ?? NO_CONVERSATIONS;

  const remaining = quota?.isPremium
    ? Infinity
    : Math.max(0, (quota?.allowance ?? 3) - (quota?.used ?? 0));

  // -----------------------------------------------------------------------
  // The open thread
  // -----------------------------------------------------------------------

  const openConversation = useCallback(async (id: string | null) => {
    setConversationId(id);
    setStreamingText('');
    setAttachments([]);

    if (!id) {
      setThread(NO_MESSAGES);
      return;
    }

    setThreadLoading(true);
    try {
      setThread(await fetchMessages(id));
    } catch {
      setThread(NO_MESSAGES);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  /** Blank slate. Nothing is written until the first message is sent. */
  const startNew = useCallback(() => {
    void openConversation(null);
  }, [openConversation]);

  const archive = useCallback(
    async (id: string) => {
      try {
        await archiveConversation(id);
        if (id === conversationId) startNew();
        refetchConversations();
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t remove that.');
      }
    },
    [conversationId, startNew, refetchConversations, toast]
  );

  // -----------------------------------------------------------------------
  // Attachments
  // -----------------------------------------------------------------------

  const attach = useCallback(
    async (file: { uri: string; mimeType: string; fileName: string }) => {
      if (!userId) return;

      // Shown immediately with a spinner rather than after the upload — picking
      // a photo and seeing nothing for two seconds reads as a failed tap.
      const placeholder: PendingAttachment = {
        storagePath: `pending:${file.uri}`,
        mimeType: file.mimeType,
        fileName: file.fileName,
        localUri: file.uri,
        uploading: true,
      };
      setAttachments((list) => [...list, placeholder]);

      try {
        const uploaded = await uploadAttachment({ userId, conversationId, ...file });
        setAttachments((list) =>
          list.map((a) => (a.storagePath === placeholder.storagePath ? uploaded : a))
        );
      } catch (thrown) {
        setAttachments((list) => list.filter((a) => a.storagePath !== placeholder.storagePath));
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t attach that.');
      }
    },
    [userId, conversationId, toast]
  );

  const removeAttachment = useCallback((storagePath: string) => {
    setAttachments((list) => list.filter((a) => a.storagePath !== storagePath));
    // Best-effort: an orphaned object is cheaper than blocking the UI on a
    // delete the user did not ask to wait for.
    if (!storagePath.startsWith('pending:')) void deleteAttachment(storagePath).catch(() => {});
  }, []);

  // -----------------------------------------------------------------------
  // Sending
  // -----------------------------------------------------------------------

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string): Promise<'ok' | 'limit-reached' | 'error'> => {
      const trimmed = text.trim();
      const ready = attachments.filter((a) => !a.uploading);

      if (!trimmed && ready.length === 0) return 'error';
      if (sending) return 'error';
      if (!quota?.isPremium && remaining <= 0) return 'limit-reached';

      const controller = new AbortController();
      abortRef.current = controller;

      // Optimistic: the user's own words appear the instant they hit send, with
      // a temporary id the refetch below replaces.
      const optimistic: CoachMessage = {
        id: `pending-${Date.now()}`,
        from: 'you',
        text: trimmed,
        attachments: ready,
        status: 'complete',
      };
      setThread((list) => [...list, optimistic]);
      setAttachments([]);
      setStreamingText('');
      setSending(true);

      let landedIn = conversationId;
      let outcome: 'ok' | 'limit-reached' | 'error' = 'ok';

      try {
        await askCoach({
          conversationId,
          text: trimmed,
          attachments: ready,
          signal: controller.signal,
          onEvent: (event) => {
            switch (event.type) {
              case 'meta':
                landedIn = event.conversationId;
                setConversationId(event.conversationId);
                break;
              case 'delta':
                setStreamingText((current) => current + event.text);
                break;
              case 'error':
                outcome = event.code === 'limit_reached' ? 'limit-reached' : 'error';
                if (event.code !== 'limit_reached') toast.error(event.message);
                break;
              case 'done':
                break;
            }
          },
        });
      } catch (thrown) {
        // An abort is the user pressing stop, not a failure.
        const aborted = controller.signal.aborted;
        if (!aborted) {
          outcome = 'error';
          toast.error(thrown instanceof Error ? thrown.message : 'The coach didn’t answer.');
        }
      } finally {
        abortRef.current = null;
        setSending(false);
        setStreamingText('');

        /*
         * Re-read rather than keeping the streamed text.
         *
         * The function stores the answer — including a partial one after a stop
         * — so the database is the version that survives a reload. Reading it
         * back is what makes the bubble on screen the same bubble that will be
         * there tomorrow, and it picks up the real message ids at the same time.
         */
        if (landedIn) {
          try {
            setThread(await fetchMessages(landedIn));
          } catch {
            // Keep the optimistic thread; the next focus will reconcile it.
          }
        }
        refetchQuota();
        refetchConversations();
      }

      return outcome;
    },
    [
      attachments,
      sending,
      quota?.isPremium,
      remaining,
      conversationId,
      toast,
      refetchQuota,
      refetchConversations,
    ]
  );

  /** Abort any in-flight reply if the screen goes away mid-stream. */
  useEffect(() => () => abortRef.current?.abort(), []);

  const remainingLabel = useMemo(() => {
    if (quota?.isPremium) return 'Unlimited';
    const allowance = quota?.allowance ?? 3;
    return `${remaining} of ${allowance} left today`;
  }, [quota?.isPremium, quota?.allowance, remaining]);

  return {
    conversationId,
    conversations,
    conversationsLoading,
    openConversation,
    startNew,
    archive,

    thread,
    threadLoading,
    streamingText,
    sending,
    stop,
    send,

    attachments,
    attach,
    removeAttachment,

    suggestions: COACH_SUGGESTIONS,
    remaining,
    isUnlimited: Boolean(quota?.isPremium),
    limitReached: !quota?.isPremium && remaining <= 0,
    remainingLabel,
  };
}
