import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/ui/google-icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useForm } from '@/hooks/use-form';
import { compose, email as emailRule, required } from '@/utils/validation';
import { palette, space } from '@/constants/tokens';

/**
 * Returning users.
 *
 * The password rule here is only `required` — deliberately weaker than on the
 * sign-up screen. Enforcing the 8-character minimum on login would reject a
 * legitimate older password before it ever reached the server, and tell the
 * user their own password is invalid.
 */
export default function Login() {
  const theme = useTheme();
  const toast = useToast();
  const { signIn } = useAuth();
  const canGoBack = router.canGoBack();

  const rules = useMemo(
    () => ({
      email: compose(required('Enter your email'), emailRule()),
      password: required('Enter your password'),
    }),
    []
  );

  const form = useForm({
    initial: { email: '', password: '' },
    rules,
    onSubmit: async (values) => {
      const result = await signIn(values.email, values.password);

      if (!result.ok) {
        if (result.field) form.setError(result.field, result.message);
        else toast.error(result.message);
        return;
      }

      toast.success('Welcome back!');
      // Signed in. `AuthGate` decides whether that means the pairing flow or
      // the app, based on whether this account already has a couple.
    },
  });

  const notWired = () =>
    toast.show('Social sign-in isn’t connected yet — use email for now.');

  const isIos = process.env.EXPO_OS === 'ios';

  return (
    <Screen gap={space.xl}>
      <Stack.Screen options={{ headerBackVisible: canGoBack }} />

      {/* The art sits in the middle ~46% of a 1024x1536 canvas — the rest is
          transparent margin — so the box is taller than the couple needs to be
          in order for them to land at a readable size. */}
      <Image
        source={require('@/assets/images/login-screen-asset.png')}
        style={{ width: '100%', height: 240 }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />

      <View style={{ gap: space.md }}>
        <Text role="title1">Welcome back</Text>
        <Text role="body" color={theme.color.textSecondary}>
          Sign in and you’ll pick up right where the two of you left off.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        {isIos ? (
          <Button label="Continue with Apple" variant="neutral" full onPress={notWired} />
        ) : null}
        <Button
          label="Continue with Google"
          variant="neutral"
          full
          left={<GoogleIcon />}
          onPress={notWired}
        />
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
        />
        <TextField
          label="Password"
          placeholder="Your password"
          value={form.values.password}
          onChangeText={(value) => form.setValue('password', value)}
          onBlur={() => form.blur('password')}
          error={form.errors.password}
          revealable
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={form.submit}
        />
        <Button
          label={form.submitting ? 'Logging in…' : 'Log in'}
          full
          disabled={form.submitting}
          onPress={form.submit}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (canGoBack) {
            router.back();
          } else {
            router.replace('/auth');
          }
        }}
        hitSlop={8}
        style={{ alignSelf: 'center' }}
      >
        <Text role="caption" center color={theme.color.textSecondary}>
          New here? <Text role="caption" color={palette.brand.rose}>Create an account</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}
