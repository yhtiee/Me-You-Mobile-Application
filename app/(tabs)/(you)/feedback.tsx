import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { submitFeedback, type FeedbackKind } from '@/lib/feedback';
import { space } from '@/constants/tokens';

const KINDS = [
  { value: 'feedback', label: 'Idea' },
  { value: 'bug', label: 'Problem' },
  { value: 'safety', label: 'Safety' },
] as const satisfies readonly { value: FeedbackKind; label: string }[];

const PROMPTS: Record<FeedbackKind, { intro: string; placeholder: string }> = {
  feedback: {
    intro: 'Tell us what you’d like to see, or what could work better.',
    placeholder: 'I wish I could…',
  },
  bug: {
    intro: 'Tell us what happened and what you expected instead.',
    placeholder: 'When I tapped… it…',
  },
  safety: {
    intro:
      'Report abuse, harassment, content involving a minor, or anything that makes you feel unsafe. We review every safety report.',
    placeholder: 'What happened, and when?',
  },
};

const MAX_LENGTH = 4000;

/**
 * In-app feedback and safety reporting.
 *
 * Google Play's Child Safety Standards policy requires this to work without
 * leaving the app, which is why it is a form and not a link to the website.
 */
export default function Feedback() {
  const theme = useTheme();
  const toast = useToast();
  const { user } = useAuth();

  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<FeedbackKind>(
    KINDS.some((k) => k.value === params.kind) ? (params.kind as FeedbackKind) : 'feedback'
  );
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);

  const valid = message.trim().length > 0;

  const submit = async () => {
    if (!user) {
      toast.error('Your session ended. Log in again to continue.');
      return;
    }

    setSending(true);
    try {
      await submitFeedback({
        userId: user.id,
        kind,
        message: message.trim(),
        contact: contact.trim() || null,
      });
      toast.success(kind === 'safety' ? 'Report sent. Thank you for telling us.' : 'Thanks, we got it.');
      router.back();
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t send that.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen gap={space.xl}>
      <SegmentedControl options={KINDS} value={kind} onChange={setKind} />

      <Text role="body" color={theme.color.textSecondary}>
        {PROMPTS[kind].intro}
      </Text>

      {kind === 'safety' ? (
        <Text role="caption" color={theme.tint.amber.fg}>
          If someone is in immediate danger, contact your local emergency services first.
        </Text>
      ) : null}

      <Card style={{ gap: space.lg }}>
        <TextField
          label="Message"
          placeholder={PROMPTS[kind].placeholder}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={MAX_LENGTH}
          textAlignVertical="top"
          style={{ minHeight: 140 }}
        />
        <TextField
          label="Reply to (optional)"
          placeholder={user?.email ?? 'you@example.com'}
          hint="Leave blank and we’ll reply to your account email."
          value={contact}
          onChangeText={setContact}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Card>

      <Button
        label={sending ? 'Sending…' : kind === 'safety' ? 'Send report' : 'Send feedback'}
        full
        disabled={!valid || sending}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
