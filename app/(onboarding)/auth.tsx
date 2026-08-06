import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import {
  compose,
  email as emailRule,
  matches,
  password as passwordRule,
  personName,
  required,
} from '@/utils/validation';
import { palette, space } from '@/constants/tokens';

/**
 * Create an account.
 *
 * Email and password are real; the social buttons are not yet — see the toast
 * below. Once the account exists, `AuthGate` routes onward off the session, so
 * nothing here navigates on success.
 */
type SignUpValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function Auth() {
  const theme = useTheme();
  const toast = useToast();
  const { signUp } = useAuth();
  const [showEmail, setShowEmail] = useState(false);

  // Memoised because `useForm` re-derives every rule whenever this object
  // changes identity — a fresh literal each render would validate on every
  // keystroke of every field.
  const rules = useMemo(
    () => ({
      firstName: personName('Enter your first name'),
      lastName: personName('Enter your last name'),
      email: compose(required('Enter your email'), emailRule()),
      password: passwordRule(),
      confirmPassword: compose(
        required('Type it once more'),
        matches<SignUpValues>('password', 'Those passwords don’t match')
      ),
    }),
    []
  );

  const form = useForm<SignUpValues>({
    initial: { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' },
    rules,
    onSubmit: async (values) => {
      const result = await signUp({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
      });

      if (!result.ok) {
        // Field-attributable failures land under the field; the rest surface as
        // a toast, because a message with no field to sit under is invisible.
        if (result.field) form.setError(result.field, result.message);
        else toast.error(result.message);
        return;
      }

      /*
       * Email confirmation is off in the Supabase project, so sign-up returns a
       * live session and we go straight to pairing.
       *
       * The branch below is not the expected path — it only fires if
       * confirmation gets switched back on, in which case the account exists
       * but cannot sign in yet. Without it that configuration change would show
       * up as a button that appears to do nothing.
       */
      if (result.needsEmailConfirmation) {
        toast.success('Check your inbox to confirm your email, then log in.');
        router.replace('/login');
        return;
      }

      toast.success('Account created!');
      // `AuthGate` would land on the same place once pairing state loads;
      // navigating here just removes the beat of waiting for that round trip.
      router.replace('/pair');
    },
  });

  const notWired = () =>
    toast.show('Social sign-in isn’t connected yet — use email for now.');

  const isIos = process.env.EXPO_OS === 'ios';

  // topPad drops from 88 to 20 now that there is art up top: the illustration
  // carries ~25% transparent margin of its own, and stacking the old breathing
  // room on that left a visible hole above it.
  return (
    <Screen topPad={space.xl} gap={space.xl}>
      <Image
        source={require('@/assets/images/login-screen-asset.png')}
        style={{ width: '100%', height: 240 }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />

      <View style={{ gap: space.md }}>
        <Text role="title1">Let’s get you in</Text>
        <Text role="body" color={theme.color.textSecondary}>
          One account each. You’ll link up with your partner in a moment.
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
        {!showEmail ? (
          <Button label="Use email instead" variant="secondary" full onPress={() => setShowEmail(true)} />
        ) : null}
      </View>

      {showEmail ? (
        <View style={{ gap: space.lg }}>
          {/*
           * Side by side because the form is already five fields deep, and two
           * short inputs stacked burn a whole row of vertical space each. Names
           * come first: they are the least effortful thing to answer, and the
           * app addresses people by first name everywhere.
           */}
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="First name"
                placeholder="Alex"
                value={form.values.firstName}
                onChangeText={(value) => form.setValue('firstName', value)}
                onBlur={() => form.blur('firstName')}
                error={form.errors.firstName}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Last name"
                placeholder="Morgan"
                value={form.values.lastName}
                onChangeText={(value) => form.setValue('lastName', value)}
                onBlur={() => form.blur('lastName')}
                error={form.errors.lastName}
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
                returnKeyType="next"
              />
            </View>
          </View>

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
            placeholder="At least 8 characters"
            value={form.values.password}
            onChangeText={(value) => form.setValue('password', value)}
            onBlur={() => form.blur('password')}
            error={form.errors.password}
            revealable
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="next"
          />
          <TextField
            label="Confirm password"
            placeholder="Type it again"
            value={form.values.confirmPassword}
            onChangeText={(value) => form.setValue('confirmPassword', value)}
            onBlur={() => form.blur('confirmPassword')}
            error={form.errors.confirmPassword}
            revealable
            // Also `new-password`, so the keychain offers to save the same
            // generated value here rather than treating it as a second secret.
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={form.submit}
          />
          <Button
            label={form.submitting ? 'Creating account…' : 'Create account'}
            full
            // Not gated on `isValid`: a permanently greyed-out button with no
            // explanation is its own dead end. Submitting reveals the messages.
            disabled={form.submitting}
            onPress={form.submit}
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/login')}
        hitSlop={8}
        style={{ alignSelf: 'center' }}
      >
        <Text role="body" center color={theme.color.textSecondary}>
          Already have an account? <Text role="bodyStrong" color={palette.brand.rose}>Log in</Text>
        </Text>
      </Pressable>

      <Text role="caption" center color={theme.color.textTertiary}>
        By continuing you agree to the Terms and Privacy Policy.
      </Text>
    </Screen>
  );
}
