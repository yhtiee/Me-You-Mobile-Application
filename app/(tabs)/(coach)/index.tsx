import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useCoach } from '@/hooks/use-coach';
import { useChromeInsets } from '@/hooks/use-chrome-insets';
import { useTheme } from '@/components/providers/theme-provider';
import { fontFamily, gutter, layout, palette, radius, space, washHeight } from '@/constants/tokens';

/**
 * AI Relationship Coach (PRD §5). Replies are canned until the LLM lands;
 * the free-tier cap of 3/day is enforced for real so the limit dialog is honest.
 */
export default function Coach() {
  const theme = useTheme();
  const chrome = useChromeInsets();
  const { thread, suggestions, remainingLabel, limitReached, ask } = useCoach();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;
    if (ask(value) === 'limit-reached') {
      router.push('/limit');
      return;
    }
    setDraft('');
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bgBase }}>
      <View
        pointerEvents="none"
        /*
         * Same top band as `Screen`, not a full-bleed fill. Coach rolls its own
         * scroll view, so it also has to match by hand: `ScreenHeader` paints
         * this identical gradient over the identical 320px to sit seamlessly on
         * top of it. Stretched over the whole screen the tone at the header's y
         * is lighter, and the bar draws a visible band across it.
         */
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: washHeight,
          experimental_backgroundImage: theme.wash,
        }}
      />

      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: chrome.top,
          paddingBottom: space.xl,
          gap: space.md,
        }}
      >
        {thread.map((message) => {
          const mine = message.from === 'you';
          return (
            <Animated.View
              key={message.id}
              entering={FadeInDown.duration(200)}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                backgroundColor: mine ? palette.brand.rose : theme.tint.iris.bg,
                borderRadius: radius.lg,
                borderCurve: 'continuous',
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
              }}
            >
              <Text role="body" selectable color={mine ? '#fff' : theme.tint.iris.fg}>
                {message.text}
              </Text>
            </Animated.View>
          );
        })}

        {thread.length <= 1 ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                onPress={() => send(suggestion)}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md - 2,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: theme.color.border,
                  backgroundColor: theme.color.surface,
                }}
              >
                <Text role="caption" color={theme.color.textSecondary}>
                  {suggestion}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: gutter,
          paddingTop: space.md,
          // Clears the native tab bar, not just the home indicator — the
          // composer used to sit underneath it.
          paddingBottom: chrome.bottom + space.md,
          borderTopWidth: 1,
          borderTopColor: theme.color.border,
          backgroundColor: theme.color.surface,
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={limitReached ? 'That’s today’s three questions.' : 'Ask anything…'}
            placeholderTextColor={theme.color.textTertiary}
            editable={!limitReached}
            multiline
            onSubmitEditing={() => send(draft)}
            style={{
              flex: 1,
              minHeight: layout.minTarget,
              maxHeight: 120,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: theme.color.surfaceSunken,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              fontFamily: fontFamily.body.regular,
              fontSize: 14,
              color: theme.color.textPrimary,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => send(draft)}
            disabled={limitReached || !draft.trim()}
            style={{
              width: layout.minTarget,
              height: layout.minTarget,
              borderRadius: layout.minTarget / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.brand.iris,
              opacity: limitReached || !draft.trim() ? 0.4 : 1,
            }}
          >
            <Text role="button" color="#fff">
              ↑
            </Text>
          </Pressable>
        </View>

        <Text role="caption" color={theme.color.textTertiary}>
          {remainingLabel}
        </Text>
      </View>
    </View>
  );
}
