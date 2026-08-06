import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { Href } from 'expo-router';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { cardGap, layout, palette, radius, shadow, space } from '@/constants/tokens';

/**
 * Replaces the Today/Us/Play segmented control.
 *
 * Those two thirds of Home are pushed screens now, so they get a standing row
 * under the banner rather than living behind a control the user had to notice
 * before they knew there was anything else to find. Today is simply Home.
 */
const ACTIONS: { href: Href; glyph: string; tint: string; label: string; hint: string }[] = [
  { href: '/us', glyph: '💞', tint: palette.brand.irisSoft, label: 'Us', hint: 'Goals & wiki' },
  { href: '/play', glyph: '🎲', tint: palette.brand.amberSoft, label: 'Play', hint: 'Settle it' },
  { href: '/todos', glyph: '📝', tint: palette.brand.roseSoft, label: 'To-do', hint: 'Just yours' },
];

export function QuickActions() {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: cardGap }}>
      {ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={`${action.label} — ${action.hint}`}
          onPress={() => router.push(action.href)}
          style={{
            flex: 1,
            minHeight: layout.minTarget,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: theme.color.surface,
            padding: space.md,
            gap: space.sm,
            boxShadow: shadow.s1,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: action.tint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 18 }}>{action.glyph}</Text>
          </View>

          <View style={{ gap: space.xs }}>
            <Text role="cardTitle">{action.label}</Text>
            <Text role="caption" color={theme.color.textTertiary} numberOfLines={1}>
              {action.hint}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
