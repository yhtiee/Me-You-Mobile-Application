import { DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthGate } from '@/components/providers/auth-gate';
import { AuthProvider, useAuth } from '@/components/providers/auth-provider';
import { CoupleProvider } from '@/components/providers/couple-provider';
import { LoaderProvider } from '@/components/providers/loader-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { palette, radius } from '@/constants/tokens';

export const unstable_settings = {
  anchor: '(onboarding)',
};

/** Navigation chrome uses the brand surface so pushed screens don't flash white. */
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.brand.rose,
    background: palette.light.bgBase,
    card: palette.light.surface,
    text: palette.light.textPrimary,
    border: palette.light.border,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  // Splash stays up until the brand faces are ready — swapping mid-render would
  // reflow every screen.
  if (!fontsLoaded) return null;

  /*
   * Provider order is load-bearing:
   *
   *   ThemeProvider   — everything below reads colours from it
   *   LoaderProvider  } overlays, so they must sit *outside* the navigator to
   *   ToastProvider   } paint above whatever screen is mounted
   *   AuthProvider    — owns the session
   *   AuthGate        — reads the session and redirects; inside the router
   */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LoaderProvider>
          <ToastProvider>
            <AuthProvider>
              <CoupleProvider>
                <NavThemeProvider value={navTheme}>
                  <AuthGate>
                    <RootNavigator />
                  </AuthGate>
                </NavThemeProvider>
              </CoupleProvider>
            </AuthProvider>
          </ToastProvider>
        </LoaderProvider>
      </ThemeProvider>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}

/**
 * Split out so it can read `useAuth()` — a component cannot consume a context
 * its own parent provides.
 *
 * Rendering nothing while the session is being restored is the point: mounting
 * the navigator first would let expo-router paint the onboarding intro for a
 * frame before the gate redirects a returning user out of it.
 */
function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />

              {/* Sheets — iOS native detents, M3 bottom sheet on Android. */}
              <Stack.Screen
                name="checkin"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: [0.62, 0.95],
                  sheetCornerRadius: radius.sheetIos,
                }}
              />
              <Stack.Screen
                name="need"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: [0.5],
                  sheetCornerRadius: radius.sheetIos,
                }}
              />
              <Stack.Screen
                name="handoff"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: [0.48],
                  sheetCornerRadius: radius.sheetIos,
                }}
              />

              {/* Dialogs — transparent so the component draws its own scrim. */}
              <Stack.Screen name="streak" options={dialogOptions} />
              <Stack.Screen name="match" options={dialogOptions} />
              <Stack.Screen name="limit" options={dialogOptions} />
              <Stack.Screen name="unpair" options={dialogOptions} />

      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

const dialogOptions = {
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;
