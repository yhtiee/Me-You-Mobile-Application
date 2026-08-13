import { router } from 'expo-router';
import type { Href } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';

import { ChecklistIcon, DiceIcon, GalleryIcon, UsIcon } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { icon, layout, radius, space } from '@/constants/tokens';

/**
 * Replaces the Today/Us/Play segmented control.
 *
 * Those two thirds of Home are pushed screens now, so they get a standing row
 * under the banner rather than living behind a control the user had to notice
 * before they knew there was anything else to find. Today is simply Home.
 *
 * No card behind the row — it sits directly on the wash, between two heavy
 * white cards, and a surface of its own made it compete with the banner above.
 * What each action gets instead is a soft-tinted circle: the same three brand
 * washes used everywhere else for these areas, so the colour is the thing that
 * tells them apart before the label is read.
 */
const CIRCLE = 56;

const ACTIONS: {
  href: Href;
  Icon: ComponentType<{ size?: number; color: string }>;
  /** Which of the theme's tints fills the circle. Resolved at render. */
  tint: 'rose' | 'iris' | 'amber' | 'success';
  label: string;
  hint: string;
}[] = [
  { href: '/us', Icon: UsIcon, tint: 'iris', label: 'Us', hint: 'Goals & wiki' },
  { href: '/play', Icon: DiceIcon, tint: 'amber', label: 'Play', hint: 'Settle it' },
  { href: '/todos', Icon: ChecklistIcon, tint: 'rose', label: 'To-do', hint: 'Just yours' },
  { href: '/gallery', Icon: GalleryIcon, tint: 'success', label: 'Gallery', hint: 'Your memories' },
];

export function QuickActions() {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row' }}>
      {ACTIONS.map(({ href, Icon, tint, label, hint }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={`${label} — ${hint}`}
          onPress={() => router.push(href)}
          /*
           * Opacity is the whole press feedback, on both platforms. An Android
           * ripple would have to land on the circle and clip to it, which reads
           * as a second, smaller button inside the first; dimming the tile is
           * legible over a gradient in a way a ripple or a highlight is not.
           */
          style={({ pressed }) => ({
            flex: 1,
            minHeight: layout.minTarget,
            alignItems: 'center',
            gap: space.sm,
            paddingVertical: space.xs,
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <View
            style={{
              width: CIRCLE,
              height: CIRCLE,
              borderRadius: radius.pill,
              backgroundColor: theme.tint[tint].bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* `fg`, not the raw brand hue: amber on amberSoft is 3.4:1, and
                the tint's own foreground is the value that clears contrast in
                both schemes. */}
            <Icon size={icon.xl} color={theme.tint[tint].fg} />
          </View>

          <Text role="cardTitle" color={theme.color.textPrimary} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
