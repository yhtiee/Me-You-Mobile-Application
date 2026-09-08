import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, type NativeStackHeaderProps } from 'expo-router';
import { getHeaderTitle } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, BellIcon, MoonIcon, SunIcon } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useProfile } from '@/hooks/use-profile';
import { useUnreadCount } from '@/hooks/use-notifications';
import { useTheme, useThemeControls } from '@/components/providers/theme-provider';
import {
  gutter,
  icon,
  layout,
  motion,
  palette,
  radius,
  shadow,
  space,
  washHeight,
} from '@/constants/tokens';

/**
 * The app header, in the two shapes the design asks for:
 *
 *   Home        avatar + greeting on the left, bell on the right
 *   Everywhere  back chevron on the left, title centred under the notch,
 *   else        bell on the right
 *
 * Both are stack `header` render props, not screen content, so the route's
 * scroll view sits *underneath* them (`headerTransparent`) and content passes
 * behind the bar rather than stopping at it.
 *
 * The background is not a blur and not a flat fill: it is the same rose wash
 * `Screen` paints, at the same 320px height, anchored to the same y=0. At rest
 * that makes the bar invisible — it continues the gradient exactly — and once
 * the screen scrolls, it is what the content disappears behind. `expo-blur` is
 * deliberately not a dependency here; a frosted bar over a coloured wash reads
 * grey, and the tab bar already owns the one glass surface in the app.
 */

const CIRCLE = layout.headerCircle;
const AVATAR = 40;

type Props = NativeStackHeaderProps & {
  /** Off on the notifications screen itself, where the bell is a no-op. */
  showBell?: boolean;
};

export function ScreenHeader({ back, options, route, navigation, showBell = true }: Props) {
  const theme = useTheme();
  const title = getHeaderTitle(options, route.name);

  return (
    <HeaderShell>
      {/* Absolute so the title stays optically centred whatever sits beside
          it — a flex-centred title shifts when only one side has a button. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: CIRCLE + space.md,
          right: CIRCLE + space.md,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text role="title3" numberOfLines={1}>
          {title}
        </Text>
      </View>

      {back ? (
        <CircleButton label="Go back" onPress={navigation.goBack}>
          <BackIcon size={icon.md} color={theme.color.textPrimary} />
        </CircleButton>
      ) : (
        <View style={{ width: CIRCLE }} />
      )}

      <View style={{ flex: 1 }} />

      {showBell ? <BellButton /> : <View style={{ width: CIRCLE }} />}
    </HeaderShell>
  );
}

/**
 * Home's header. Not a variant prop on `ScreenHeader` — it shares only the
 * shell, and the two have different content, different data and different
 * heights of hierarchy.
 */
export function HomeHeader() {
  const theme = useTheme();
  const { user } = useAuth();

  /*
   * Reads the profile row, not the session.
   *
   * It used to read `user_metadata.avatar_url`, which is only ever set by an
   * OAuth provider — so a photo uploaded on the profile screen, which writes
   * `profiles.avatar_url`, never appeared here. The name has the same problem
   * once someone edits their display name.
   *
   * The cost is that this row is fetched twice on Home: once here and once by
   * `ProfilePrompt` inside the screen, because the header renders in the
   * navigator's subtree and cannot share the screen's hooks. It is a single row
   * by primary key, and both copies are kept fresh by the same realtime
   * subscription. A shared cache would collapse them, and is the reason to add
   * one.
   */
  const { profile } = useProfile();
  const metadata = user?.user_metadata as { first_name?: string } | undefined;

  const name =
    profile?.displayName ?? metadata?.first_name?.trim() ?? user?.email?.split('@')[0] ?? 'You';

  return (
    <HeaderShell>
      <Avatar uri={profile?.avatarUrl ?? null} name={name} />

      <View style={{ flex: 1, marginLeft: space.md, gap: 1 }}>
        <Text role="caption" color={theme.color.textSecondary}>
          {greeting()}
        </Text>
        <Text role="title3" numberOfLines={1}>
          {name}
        </Text>
      </View>

      <ThemeToggle />
      <BellButton />
    </HeaderShell>
  );
}

/**
 * Light/dark, one tap, on the screen people open most.
 *
 * Shows the scheme you would switch *to*, not the one you are in — a sun while
 * it is light reads as a status light nobody can turn off, and the whole point
 * of a header control is that it says what the tap does.
 */
function ThemeToggle() {
  const theme = useTheme();
  const { toggle } = useThemeControls();
  const dark = theme.scheme === 'dark';

  return (
    <View style={{ marginRight: space.sm }}>
      <CircleButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onPress={toggle}>
        {dark ? (
          <SunIcon size={icon.md} color={theme.color.textPrimary} />
        ) : (
          <MoonIcon size={icon.md} color={theme.color.textPrimary} />
        )}
      </CircleButton>
    </View>
  );
}

/*
 * Render props for `Stack`'s `header` option.
 *
 * They live here rather than inline in the layouts so `constants/nav-options`
 * — a plain `.ts` module — can hold the shared stack options without JSX, and
 * so no route can accidentally define its own inline arrow (which remounts the
 * header on every render of the navigator).
 */
export const renderScreenHeader = (props: NativeStackHeaderProps) => <ScreenHeader {...props} />;

export const renderHomeHeader = () => <HomeHeader />;

/** For screens where the bell would point at itself. */
export const renderHeaderWithoutBell = (props: NativeStackHeaderProps) => (
  <ScreenHeader {...props} showBell={false} />
);

/**
 * Bar chrome shared by both headers: the wash, the notch padding and the row.
 *
 * `overflow: hidden` is what clips the 320px wash down to the bar — the inner
 * view is deliberately taller than its parent so the gradient is sampled at the
 * same rate as the screen's, rather than being squashed into the header height.
 */
function HeaderShell({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ overflow: 'hidden', backgroundColor: theme.color.bgBase, marginBottom: 20 }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: washHeight,
          experimental_backgroundImage: theme.wash,
        }}
      />
      <View style={{ paddingTop: insets.top }}>
        <View
          style={{
            height: layout.headerBar,
            paddingHorizontal: gutter,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

/**
 * The bell, with an unread dot.
 *
 * A dot rather than a number. The count is not actionable — nobody behaves
 * differently for three notifications than for one — and a numeral inside a
 * 36px circle either shrinks below legibility or breaks the circle at "10+".
 * What the user needs to know is whether there is anything new.
 *
 * `useUnreadCount` is a `COUNT(*)` over a partial index with no payload, which
 * matters because this component mounts on every screen that has a header.
 */
function BellButton() {
  const theme = useTheme();
  const unread = useUnreadCount();

  return (
    <View>
      <CircleButton label="Notifications" onPress={() => router.push('/notifications')}>
        <BellIcon size={icon.md} color={theme.color.textPrimary} />
      </CircleButton>

      {unread > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            width: 12,
            height: 12,
            borderRadius: radius.pill,
            backgroundColor: palette.brand.rose,
            // Ringed in the bar's own ground so the dot reads as sitting on top
            // of the circle rather than merging into its edge.
            borderWidth: 2,
            borderColor: theme.color.bgBase,
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * The 36px circle the tokens doc specs for the back affordance, reused for the
 * bell so the two ends of the bar balance.
 *
 * Swipe-back and the Android hardware button are untouched — the native header
 * is off, not the gesture — and `hitSlop` takes the 36px circle out to the 48px
 * minimum target without making the circle itself look heavy.
 */
function CircleButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isIos = process.env.EXPO_OS === 'ios';

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={(layout.minTarget - CIRCLE) / 2}
      onPressIn={() => {
        if (!isIos) return;
        scale.set(withTiming(0.92, { duration: motion.tap.ms }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        if (!isIos) return;
        scale.set(withTiming(1, { duration: motion.tap.ms }));
      }}
      android_ripple={{ color: 'rgba(34,26,43,0.12)', borderless: true, radius: CIRCLE / 2 }}
      style={[
        {
          width: CIRCLE,
          height: CIRCLE,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.color.surface,
          boxShadow: shadow.s1,
        },
        animatedStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Rose ring matches the "you" person colour used by the couple banner. */
function Avatar({ uri, name }: { uri: string | null; name: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        width: AVATAR,
        height: AVATAR,
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: palette.person.you,
        backgroundColor: theme.color.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Text role="cardTitle" color={theme.color.textSecondary}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

/** Local clock, not the server's — the greeting is about the user's morning. */
function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
