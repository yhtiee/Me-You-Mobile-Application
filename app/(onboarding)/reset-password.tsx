import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useForm } from '@/hooks/use-form';
import { requestPasswordResetCode } from '@/lib/password-reset';
import { compose, exactLength, matches, password as passwordRule, required } from '@/utils/validation';
import { fontFamily, palette, space } from '@/constants/tokens';

const CODE_LENGTH = 6;

/** Matches the server's cooldown, so "Send again" is never a silent no-op. */
const RESEND_SECONDS = 60;

type ResetValues = { code: string; password: string; confirmPassword: string };

/**
 * Step two: the code from the email, and the new password, on one screen.
 *
 * On success `resetPassword` signs in, and `AuthGate` takes it from there —
 * straight into the app, or into pairing for an account without a partner.
 * There's deliberately no navigation here for the success case.
 */
export default function ResetPassword() {
  const theme = useTheme();
  const toast = useToast();
  const { resetPassword } = useAuth();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();

  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const rules = useMemo(
    () => ({
      code: compose(required('Enter the code from the email'), exactLength(CODE_LENGTH, 'The code is 6 digits')),
      password: passwordRule(),
      confirmPassword: compose(
        required('Type it once more'),
        matches<ResetValues>('password', 'Those passwords don’t match')
      ),
    }),
    []
  );

  const form = useForm<ResetValues>({
    initial: { code: '', password: '', confirmPassword: '' },
    rules,
    onSubmit: async (values) => {
      const result = await resetPassword({ email, code: values.code, password: values.password });
      if (!result.ok) {
        if (result.field === 'code' || result.field === 'password') {
          form.setError(result.field, result.message);
        } else {
          toast.error(result.message);
          // The password changed but sign-in didn't follow: send them to log in.
          if ('passwordChanged' in result && result.passwordChanged) router.replace('/login');
        }
        return;
      }
      toast.success('Password changed. You’re signed in.');
    },
  });

  const resend = async () => {
    if (cooldown > 0) return;
    setCooldown(RESEND_SECONDS);
    const result = await requestPasswordResetCode(email);
    if (result.ok) toast.show('We’ve sent a new code. Only the newest one works.');
    else toast.error(result.message);
  };

  if (!email) {
    // Reached without an address (a stale link, a restored route): start over.
    return (
      <Screen gap={space.xl}>
        <Text role="body" color={theme.color.textSecondary}>
          Start again by entering your email.
        </Text>
        <Button label="Enter email" full onPress={() => router.replace('/forgot-password')} />
      </Screen>
    );
  }

  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.md }}>
        <Text role="title2">Check your email</Text>
        <Text role="body" color={theme.color.textSecondary}>
          If there’s an account for <Text role="body">{email}</Text>, we’ve sent it a 6-digit code. It
          expires in 15 minutes.
        </Text>
      </View>

      <View style={{ gap: space.lg }}>
        <TextField
          label="Code"
          placeholder="000000"
          value={form.values.code}
          onChangeText={(t) => form.setValue('code', t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          onBlur={() => form.blur('code')}
          error={form.errors.code}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          style={{
            fontFamily: fontFamily.display.bold,
            fontSize: 28,
            letterSpacing: 8,
            textAlign: 'center',
            paddingVertical: space.xl,
          }}
        />
        <TextField
          label="New password"
          placeholder="At least 8 characters"
          value={form.values.password}
          onChangeText={(value) => form.setValue('password', value)}
          onBlur={() => form.blur('password')}
          error={form.errors.password}
          revealable
          textContentType="newPassword"
          autoComplete="new-password"
        />
        <TextField
          label="Confirm new password"
          placeholder="Type it once more"
          value={form.values.confirmPassword}
          onChangeText={(value) => form.setValue('confirmPassword', value)}
          onBlur={() => form.blur('confirmPassword')}
          error={form.errors.confirmPassword}
          revealable
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={form.submit}
        />
        <Button
          label={form.submitting ? 'Saving…' : 'Set new password'}
          full
          disabled={form.submitting}
          onPress={form.submit}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: cooldown > 0 }}
        onPress={resend}
        hitSlop={8}
        style={{ alignSelf: 'center' }}
      >
        <Text role="caption" center color={theme.color.textSecondary}>
          Didn’t get it?{' '}
          {cooldown > 0 ? (
            <Text role="caption" color={theme.color.textTertiary}>
              Send again in {cooldown}s
            </Text>
          ) : (
            <Text role="caption" color={palette.brand.rose}>
              Send again
            </Text>
          )}
        </Text>
      </Pressable>
    </Screen>
  );
}
