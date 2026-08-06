import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AdSlot } from '@/components/ui/ad-slot';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { cardGap, palette, radius, space } from '@/constants/tokens';
import type { Href } from 'expo-router';

/**
 * PRD Module 2, "Play & Settle".
 *
 * The redesign nests these under Home rather than giving Tools its own tab —
 * following the mock, noted in the implementation plan.
 */
const TOOLS: { href: Href; glyph: string; tint: string; title: string; body: string }[] = [
  {
    href: '/tools/coin',
    glyph: '🪙',
    tint: palette.brand.amberSoft,
    title: 'Bigger person',
    body: 'Flip for who apologises, or who buys the coffee.',
  },
  {
    href: '/tools/wheel',
    glyph: '🎡',
    tint: palette.brand.roseSoft,
    title: 'Whose turn',
    body: 'Spin for chores neither of you wants.',
  },
  {
    href: '/tools/date',
    glyph: '📅',
    tint: palette.brand.irisSoft,
    title: 'Date setter',
    body: 'Plan it, or let the app decide. Raincheck without guilt.',
  },
  {
    href: '/tools/picker',
    glyph: '🍿',
    tint: '#E6F1EA',
    title: 'Movie & meal',
    body: 'Swipe separately. You’ll only hear about the matches.',
  },
  {
    href: '/tools/games',
    glyph: '🎯',
    tint: '#FDECE6',
    title: 'Games & growth',
    body: 'Trivia about each other, plus habits worth building.',
  },
];

export function PlaySegment() {
  const theme = useTheme();

  return (
    <>
      <Text role="body" color={theme.color.textSecondary}>
        Small tools for the decisions that aren’t worth an argument.
      </Text>

      <View style={{ gap: cardGap }}>
        {TOOLS.map((tool) => (
          <Pressable
            key={tool.title}
            accessibilityRole="button"
            accessibilityLabel={tool.title}
            onPress={() => router.push(tool.href)}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.md,
                  borderCurve: 'continuous',
                  backgroundColor: tool.tint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 24 }}>{tool.glyph}</Text>
              </View>
              <View style={{ flex: 1, gap: space.xs }}>
                <Text role="cardTitle">{tool.title}</Text>
                <Text role="caption" color={theme.color.textSecondary}>
                  {tool.body}
                </Text>
              </View>
              <Text role="body" color={theme.color.textTertiary}>
                ›
              </Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <AdSlot />
    </>
  );
}
