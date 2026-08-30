import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

import { Composer } from '@/components/coach/composer';
import { MessageBubble, SuggestionChip, TypingBubble } from '@/components/coach/message-bubble';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCoach } from '@/hooks/use-coach';
import { useChromeInsets } from '@/hooks/use-chrome-insets';
import { useTheme } from '@/components/providers/theme-provider';
import { gutter, radius, space, washHeight } from '@/constants/tokens';

/**
 * AI Relationship Coach (PRD §5), on Gemini through the `coach` Edge Function.
 *
 * The keyboard handling here is the part worth reading. This screen rolls its
 * own scroll view rather than using `Screen`, and it pins a composer to the
 * bottom — which previously sat under the keyboard the moment it was tapped,
 * because nothing moved it. `KeyboardAvoidingView` is not the fix: it needs
 * different `behavior` per platform, and under `edgeToEdgeEnabled` Android 15
 * ignores `adjustResize` entirely (see `useKeyboardInset`), so the window never
 * shrinks and the view has nothing to avoid.
 *
 * `useAnimatedKeyboard` reports the real covered height on both platforms and
 * drives the padding on the UI thread, so the composer tracks the keyboard
 * frame-for-frame as it opens instead of jumping when it lands.
 */
export default function Coach() {
  const theme = useTheme();
  const chrome = useChromeInsets();
  const keyboard = useAnimatedKeyboard();

  /** Set by the history screen when a past conversation is chosen. */
  const params = useLocalSearchParams<{ conversationId?: string }>();

  const {
    conversationId,
    openConversation,
    conversations,
    thread,
    threadLoading,
    streamingText,
    sending,
    stop,
    send,
    attachments,
    attach,
    removeAttachment,
    startNew,
    suggestions,
    remainingLabel,
    limitReached,
  } = useCoach();

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  /*
   * Open whatever history handed us.
   *
   * Guarded on it actually differing, because the param survives in the URL
   * after the thread is open — without the check, every render would reopen the
   * conversation and throw away an in-flight reply.
   */
  useEffect(() => {
    const wanted = params.conversationId;
    if (wanted && wanted !== conversationId) void openConversation(wanted);
  }, [params.conversationId, conversationId, openConversation]);

  const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });

  /*
   * Follow the conversation down as it grows *and* as it streams. The streamed
   * text is a dependency because a long reply keeps growing after the message
   * count has stopped changing.
   */
  useEffect(() => {
    const id = setTimeout(scrollToEnd, 60);
    return () => clearTimeout(id);
  }, [thread.length, streamingText]);

  const shellStyle = useAnimatedStyle(() => {
    /*
     * iOS only adds the keyboard height. Android must not — and this was the bug.
     *
     * `app.json` sets `softwareKeyboardLayoutMode: "resize"`, so Android already
     * shrinks the window when the keyboard opens: the tab bar rides up on its
     * own and the layout is handed a shorter viewport. Adding the keyboard
     * height on top of that pushed the composer up by a *second* keyboard
     * height — off the top of the visible area, with the tab bar left sitting
     * where the input should have been. That is why the input looked covered by
     * the nav bar, and why nothing down there could be tapped afterwards.
     *
     * iOS does not resize; the keyboard is an overlay, so there the height is
     * exactly what has to be added. `chrome.bottom` remains the floor on both,
     * because the tab bar still has to be cleared when the keyboard is closed.
     */
    const overlay = process.env.EXPO_OS === 'ios' ? keyboard.height.value : 0;
    return { paddingBottom: Math.max(overlay, chrome.bottom) };
  });

  const submit = async (text: string) => {
    const value = text.trim();
    if (!value && attachments.length === 0) return;

    setDraft('');
    const outcome = await send(value);
    if (outcome === 'limit-reached') {
      // Put the text back — the question was never asked.
      setDraft(value);
      router.push('/limit');
    }
  };

  const showSuggestions = thread.length === 0 && !sending && !threadLoading;

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

      <Animated.View style={[{ flex: 1 }, shellStyle]}>
        <ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: chrome.top,
            paddingBottom: space.xl,
            gap: space.md,
          }}
        >
          {/* Thread bar. Lives in the scroll content rather than the navigation
              header, which is shared across four stacks and has no slot for
              per-screen actions. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingBottom: space.xs,
            }}
          >
            <Text role="caption" color={theme.color.textSecondary} style={{ flex: 1 }}>
              {thread.length === 0 ? 'New conversation' : 'Private — your partner never sees this'}
            </Text>

            {conversations.length > 0 ? (
              <BarButton label="History" onPress={() => router.push('/history')} />
            ) : null}
            {thread.length > 0 ? (
              <BarButton
                label="New"
                onPress={() => {
                  startNew();
                  setDraft('');
                  // Clears the param too, or the effect above would immediately
                  // reopen the conversation that was just closed.
                  router.setParams({ conversationId: undefined });
                }}
              />
            ) : null}
          </View>

          {threadLoading ? (
            <View style={{ gap: space.md }}>
              <Skeleton height={54} round={radius.lg} width="70%" />
              <Skeleton height={38} round={radius.lg} width="45%" />
            </View>
          ) : null}

          {thread.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* The reply as it arrives, then nothing — the finished version comes
              back from the database in `thread` the moment the stream ends. */}
          {sending && streamingText ? (
            <MessageBubble
              streaming
              message={{ id: 'streaming', from: 'coach', text: streamingText }}
            />
          ) : sending ? (
            <TypingBubble />
          ) : null}

          {showSuggestions ? (
            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Text role="body" color={theme.color.textSecondary}>
                Hey. I’m here whenever something’s sitting heavy, or when you just
                want a good date idea. What’s on your mind?
              </Text>
              {suggestions.map((suggestion) => (
                <SuggestionChip
                  key={suggestion}
                  label={suggestion}
                  onPress={() => void submit(suggestion)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>

        <Composer
          draft={draft}
          onChangeDraft={setDraft}
          onSend={() => void submit(draft)}
          onStop={stop}
          sending={sending}
          disabled={limitReached && !sending}
          placeholder={limitReached ? 'That’s today’s three questions.' : 'Ask anything…'}
          attachments={attachments}
          onAttach={attach}
          onRemoveAttachment={removeAttachment}
          footer={remainingLabel}
        />
      </Animated.View>
    </View>
  );
}

function BarButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.sm}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        backgroundColor: theme.color.surface,
        borderWidth: 1,
        borderColor: theme.color.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text role="caption" color={theme.color.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}
