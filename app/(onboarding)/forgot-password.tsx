import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useForm } from '@/hooks/use-form';
import { requestPasswordResetCode } from '@/lib/password-reset';
import { compose, email as emailRule, required } from '@/utils/validation';
import { space } from '@/constants/tokens';

/**
 * Step one of the custom reset: ask for a code by email.
 *
 * The next screen is shown whether or not the address has an account. The
 * server answers the same either way so this screen can't be used to find out
 * who has signed up, and the screen keeps that promise by not branching.
 */
export default function ForgotPassword() {
  const theme = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ email?: string }>();

  const rules = useMemo(() => ({ email: compose(required('Enter your email'), emailRule()) }), []);

  const form = useForm({
    initial: { email: params.email ?? '' },
    rules,
    onSubmit: async (values) => {
      const result = await requestPasswordResetCode(values.email);
      if (!result.ok) {
        if (result.field === 'email') form.setError('email', result.message);
        else toast.error(result.message);
        return;
      }
      router.push({ pathname: '/reset-password', params: { email: values.email.trim() } });
    },
  });

  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.md }}>
        <Text role="title2">Forgot your password?</Text>
        <Text role="body" color={theme.color.textSecondary}>
          Enter the email you signed up with and we’ll send you a 6-digit code to set a new one.
        </Text>
      </View>

      <View style={{ gap: space.lg }}>
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={form.values.email}
          onChangeText={(value) => form.setValue('email', value)}
          onBlur={() => form.blur('email')}
          error={form.errors.email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={form.submit}
        />
        <Button
          label={form.submitting ? 'Sending…' : 'Send code'}
          full
          disabled={form.submitting}
          onPress={form.submit}
        />
      </View>
    </Screen>
  );
}
