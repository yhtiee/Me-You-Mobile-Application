import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';

import { TabBarInsetProvider } from '@/components/ui/tab-bar-inset';
import { fontFamily, tabColors } from '@/constants/tokens';

/**
 * Four tabs: Home / Coach / Calendar / You.
 *
 * SDK 54 notes:
 * - `Icon`/`Label` are standalone components, not `NativeTabs.Trigger.Icon`
 *   (that nesting arrived in SDK 55).
 * - There is no `md` prop yet, so Android icons go through `androidSrc` with a
 *   `VectorIcon` element rather than native drawables — which keeps the app
 *   running in Expo Go instead of requiring a custom build.
 * - The bar reports no content insets, so `TabBarInsetProvider` hands its height
 *   down to the screens instead. Content scrolls *under* the glass by design;
 *   `useChromeInsets` is what keeps anything from being stranded there.
 */
export default function TabLayout() {
  return (
    <TabBarInsetProvider>
      <NativeTabs
        tintColor={tabColors.active}
        iconColor={{ default: tabColors.inactive, selected: tabColors.active }}
        labelStyle={{ fontFamily: fontFamily.body.bold, fontSize: 10 }}
        minimizeBehavior="onScrollDown"
        // Frosted chrome. `blurEffect` is the iOS half; `backgroundColor` is a
        // translucent tint layered over it there and the whole effect on
        // Android, where Material 3's bottom nav has no blur to give.
        blurEffect="systemChromeMaterialLight"
        backgroundColor={tabColors.glass}
        shadowColor={tabColors.glassHairline}
        rippleColor={tabColors.ripple}
        // Without this the scroll-edge appearance is forced to fully
        // transparent (see `createScrollEdgeAppearanceFromOptions`), so the
        // glass would vanish whenever a screen sat at the top or bottom of its
        // content — which is most of them.
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger name="(home)">
          <Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            androidSrc={<VectorIcon family={MaterialIcons} name="home" />}
          />
          <Label>Home</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(coach)">
          <Icon
            sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
            androidSrc={<VectorIcon family={MaterialIcons} name="forum" />}
          />
          <Label>Coach</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(calendar)">
          <Icon
            sf={{ default: 'calendar', selected: 'calendar' }}
            androidSrc={<VectorIcon family={MaterialIcons} name="event" />}
          />
          <Label>Calendar</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(you)">
          <Icon
            sf={{ default: 'heart', selected: 'heart.fill' }}
            androidSrc={<VectorIcon family={MaterialIcons} name="favorite" />}
          />
          <Label>You</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </TabBarInsetProvider>
  );
}
