import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/components/providers/theme-provider';
import { fontFamily, floatingTabBar, icon, radius, tabColors } from '@/constants/tokens';

/**
 * Four tabs: Home / Coach / Calendar / You, in a floating glass capsule.
 *
 * A JS tab bar, not `NativeTabs`, and that is the whole point of this file.
 *
 * `NativeTabs` renders a real `UITabBar` on iOS and a Material 3
 * `BottomNavigationView` on Android. The Android one applies its own elevation
 * surface tint *on top of* whatever `backgroundColor` it is handed, and
 * expo-router exposes no way to switch that off — `shadowColor` is documented
 * `@platform iOS`, and neither expo-router's props nor react-native-screens'
 * bottom-tabs types carry an elevation or tint knob. It also cannot float: the
 * native bar is bolted to the bottom edge. Both of those are why this is JS.
 *
 * The capsule is `position: 'absolute'`, so the screen's background runs
 * unbroken to the bottom of the phone and the bar sits over it. Nothing is
 * bolted to the edge, so there is no seam to match — which is the more robust
 * answer to "the bar is a different colour" than trying to match two opaque
 * fills exactly.
 *
 * This reverses the choice locked in UI_IMPLEMENTATION_PLAN §0, which was made
 * before the Android tint problem was known.
 */
export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const glass = theme.scheme === 'dark' ? tabColors.dark : tabColors.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabColors.active,
        tabBarInactiveTintColor: tabColors.inactive,
        tabBarLabelStyle: { fontFamily: fontFamily.body.bold, fontSize: 10 },
        // Transparent, because `tabBarBackground` paints the glass. A fill here
        // would sit *over* the blur and defeat it.
        tabBarStyle: {
          position: 'absolute',
          left: floatingTabBar.inset,
          right: floatingTabBar.inset,
          bottom: insets.bottom + floatingTabBar.lift,
          height: floatingTabBar.height,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          // Clips the blur to the capsule. Without it the BlurView paints a
          // rectangle and the rounded corners show as square glass.
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView
              tint={theme.scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
              intensity={floatingTabBar.intensity}
              /*
               * Android has no blur primitive of its own, so expo-blur renders
               * a plain translucent view unless a method is named — which is
               * exactly the "Android doesn't match iOS" gap. The Sdk31Plus
               * variant is the one to use: it falls back to no blur on older
               * Android rather than paying the documented performance cost
               * there, so the effect degrades instead of dropping frames.
               */
              blurMethod="dimezisBlurViewSdk31Plus"
              style={StyleSheet.absoluteFill}
            />
            {/* Contrast floor over the blur — see `tabColors`. */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.scrim }]} />
            {/* The capsule's rim. A border rather than a shadow so it survives
                on a light background, where a shadow reads as nothing. */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: radius.pill,
                  borderCurve: 'continuous',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: glass.hairline,
                },
              ]}
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={icon.md} color={color} />,
        }}
      />

      <Tabs.Screen
        name="(coach)"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color }) => <MaterialIcons name="forum" size={icon.md} color={color} />,
        }}
      />

      <Tabs.Screen
        name="(calendar)"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <MaterialIcons name="event" size={icon.md} color={color} />,
        }}
      />

      <Tabs.Screen
        name="(you)"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <MaterialIcons name="favorite" size={icon.md} color={color} />,
        }}
      />
    </Tabs>
  );
}
