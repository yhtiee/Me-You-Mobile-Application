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
  /*
   * Both flags are load-bearing, and leaving them off is what turned the system
   * bars a different colour app-wide.
   *
   * On Android, Reanimated takes over the window's inset handling for as long as
   * a keyboard subscription is alive, and with these unset — the default is
   * `undefined` — it puts the window back to fitting system windows. The app
   * stops drawing under the status and navigation bars, so the system paints its
   * own background there and the bars stop matching the screen.
   *
   * The reason it survived leaving this screen is that `subscribeForKeyboardEvents`
   * fires on first render and only unsubscribes on unmount, and react-navigation
   * keeps tab screens mounted. So opening Coach once changed the window for the
   * rest of the session, on every tab — which is exactly how it presented.
   *
   * This app is edge-to-edge everywhere (mandatory from Android 16), so the
   * honest value for both is `true`: keep drawing under the bars, and just tell
   * me how tall the keyboard is.
   */
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });

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
     * Both platforms add the keyboard height now. Android used to be excluded,
     * and that exclusion is what left the composer under the keyboard.
     *
     * The old reasoning was sound for the app as it then was: `app.json` asks
     * for `softwareKeyboardLayoutMode: "resize"`, Android shrank the window, the
     * layout got a shorter viewport, and adding the height on top of that lifted
     * the composer by a *second* keyboard height.
     *
     * That stopped being true. Android 15 ignores `adjustResize` for a window
     * drawing edge-to-edge — which is now every window, since Android 16 makes
     * edge-to-edge mandatory — so the window keeps its full height and the
     * keyboard simply covers the bottom of it. `hooks/use-keyboard-inset.ts` has
     * documented exactly this for the `Screen` forms all along; this screen
     * rolls its own scroll view and never got the same treatment.
     *
     * It was masked until recently: with `useAnimatedKeyboard` called with no
     * options, Reanimated put the window back to fitting system windows while a
     * keyboard subscription was alive, which restored the resize this code was
     * relying on. Passing `isStatusBarTranslucentAndroid` / `isNavigationBarTranslucentAndroid`
     * — needed to stop the system bars changing colour app-wide — removed that
     * side effect and left nothing lifting the composer.
     *
     * `chrome.bottom` stays the floor: with the keyboard closed the composer
     * still has to clear the tab bar. On Android the reported height already
     * spans the translucent navigation bar, so `max` is the right combinator
     * rather than a sum.
     */
    return { paddingBottom: Math.max(keyboard.height.value, chrome.bottom) };
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
