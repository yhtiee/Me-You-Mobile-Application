import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { TabBarInsetProvider } from '@/components/ui/tab-bar-inset';
import { useTheme } from '@/components/providers/theme-provider';
import { fontFamily, tabColors } from '@/constants/tokens';

const { Trigger } = NativeTabs;

/**
 * Four tabs: Home / Coach / Calendar / You.
 *
 * SDK 57 notes:
 * - `Icon`/`Label` are nested on the trigger (`NativeTabs.Trigger.Icon`), not
 *   standalone exports of `expo-router/unstable-native-tabs` — that move landed
 *   in SDK 55 and the old top-level exports are gone.
 * - Android icons stay vector-drawn: `src` takes a `Trigger.VectorIcon`
 *   element, which is the renamed `androidSrc`. There is an `md` prop now, but
 *   it resolves native Material symbols and so needs a custom build; the vector
 *   route keeps the app running in Expo Go.
 * - Native tabs apply content insets automatically as of SDK 57 (a bottom
 *   `SafeAreaView` on Android, `contentInsetAdjustmentBehavior` on the first
 *   nested scroll view on iOS). This app measures its own chrome instead — see
 *   `useChromeInsets` — so every trigger opts out; otherwise routes pay for the
 *   bar twice and the glass stops having anything to scroll under.
 */
export default function TabLayout() {
  const theme = useTheme();

  return (
    <TabBarInsetProvider>
      <NativeTabs
        tintColor={tabColors.active}
        iconColor={{ default: tabColors.inactive, selected: tabColors.active }}
        labelStyle={{ fontFamily: fontFamily.body.bold, fontSize: 10 }}
        minimizeBehavior="onScrollDown"
        // Frosted chrome. `blurEffect` is the iOS half; `backgroundColor` is a
        // translucent tint layered over it there and the whole effect on
        // Android, where Material 3's bottom nav has no blur to give. Both come
        // from the theme — a light-tinted glass over a dark app reads as a
        // white bar somebody forgot to style.
        blurEffect={theme.tabBlur}
        backgroundColor={theme.tabGlass}
        shadowColor={tabColors.glassHairline}
        rippleColor={tabColors.ripple}
        // Without this the scroll-edge appearance is forced to fully
        // transparent (see `createScrollEdgeAppearanceFromOptions`), so the
        // glass would vanish whenever a screen sat at the top or bottom of its
        // content — which is most of them.
        disableTransparentOnScrollEdge
      >
        <Trigger name="(home)" disableAutomaticContentInsets>
          <Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            src={<Trigger.VectorIcon family={MaterialIcons} name="home" />}
          />
          <Trigger.Label>Home</Trigger.Label>
        </Trigger>

        <Trigger name="(coach)" disableAutomaticContentInsets>
          <Trigger.Icon
            sf={{
              default: 'bubble.left.and.bubble.right',
              selected: 'bubble.left.and.bubble.right.fill',
            }}
            src={<Trigger.VectorIcon family={MaterialIcons} name="forum" />}
          />
          <Trigger.Label>Coach</Trigger.Label>
        </Trigger>

        <Trigger name="(calendar)" disableAutomaticContentInsets>
          <Trigger.Icon
            sf={{ default: 'calendar', selected: 'calendar' }}
            src={<Trigger.VectorIcon family={MaterialIcons} name="event" />}
          />
          <Trigger.Label>Calendar</Trigger.Label>
        </Trigger>

        <Trigger name="(you)" disableAutomaticContentInsets>
          <Trigger.Icon
            sf={{ default: 'heart', selected: 'heart.fill' }}
            src={<Trigger.VectorIcon family={MaterialIcons} name="favorite" />}
          />
          <Trigger.Label>You</Trigger.Label>
        </Trigger>
      </NativeTabs>
    </TabBarInsetProvider>
  );
}
