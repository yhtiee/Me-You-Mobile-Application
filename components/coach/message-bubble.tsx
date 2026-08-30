import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Glyph } from '@/components/ui/glyph';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { signAttachment } from '@/lib/coach';
import { palette, radius, space } from '@/constants/tokens';
import type { CoachAttachment, CoachMessage } from '@/types/domain';

type Props = {
  message: CoachMessage;
  /** Renders the caret and suppresses the entrance animation while text arrives. */
  streaming?: boolean;
};

export function MessageBubble({ message, streaming }: Props) {
  const theme = useTheme();
  const mine = message.from === 'you';
  const failed = message.status === 'failed';
  const cancelled = message.stopReason === 'cancelled';

  const content = (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '86%',
        backgroundColor: mine ? palette.brand.rose : theme.tint.iris.bg,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        // The corner nearest the sender is squared off — the standard cue for
        // which side a bubble belongs to, and it survives both themes where a
        // tail would need redrawing.
        borderBottomRightRadius: mine ? radius.sm : radius.lg,
        borderBottomLeftRadius: mine ? radius.lg : radius.sm,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        gap: message.attachments?.length ? space.sm : 0,
        opacity: failed && !cancelled ? 0.6 : 1,
      }}
    >
      {message.attachments?.map((attachment) => (
        <Attachment key={attachment.storagePath} attachment={attachment} onDark={mine} />
      ))}

      {message.text ? (
        <Text role="body" selectable color={mine ? '#fff' : theme.tint.iris.fg}>
          {message.text}
          {streaming ? (
            // A block caret rather than a spinner: it sits in the text flow, so
            // the bubble does not resize when the answer finishes.
            <Text role="body" color={theme.tint.iris.muted}>
              {' ▌'}
            </Text>
          ) : null}
        </Text>
      ) : null}

      {cancelled ? (
        <Text role="caption" color={mine ? 'rgba(255,255,255,0.8)' : theme.tint.iris.muted}>
          You stopped this reply.
        </Text>
      ) : failed ? (
        <Text role="caption" color={theme.color.danger}>
          That didn’t send.
        </Text>
      ) : null}
    </View>
  );

  // Entering animations replay on every render while a stream is updating,
  // which makes the bubble twitch with each token.
  if (streaming) return content;

  return <Animated.View entering={FadeInDown.duration(180)}>{content}</Animated.View>;
}

function Attachment({ attachment, onDark }: { attachment: CoachAttachment; onDark: boolean }) {
  const theme = useTheme();
  const isImage = attachment.mimeType.startsWith('image/');
  const [uri, setUri] = useState<string | null>(attachment.localUri ?? null);

  useEffect(() => {
    // A locally-picked file is already on disk; only fetched ones need signing.
    if (attachment.localUri || !isImage) return;
    let active = true;
    void signAttachment(attachment.storagePath).then((signed) => {
      if (active) setUri(signed);
    });
    return () => {
      active = false;
    };
  }, [attachment.storagePath, attachment.localUri, isImage]);

  if (isImage) {
    return (
      <Image
        source={uri ? { uri } : null}
        // The bucket is private, so this is a signed URL with an expiry. Caching
        // on the URL would key on a string that changes every hour and miss
        // every time; `memory-disk` with the default policy still dedupes
        // within a session.
        contentFit="cover"
        transition={120}
        style={{
          width: 200,
          height: 200,
          borderRadius: radius.md,
          backgroundColor: theme.color.surfaceSunken,
        }}
      />
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        backgroundColor: onDark ? 'rgba(255,255,255,0.18)' : theme.color.surface,
      }}
    >
      <Glyph size={16}>📄</Glyph>
      <Text
        role="caption"
        numberOfLines={1}
        color={onDark ? '#fff' : theme.color.textSecondary}
        style={{ flexShrink: 1 }}
      >
        {attachment.fileName ?? 'Attachment'}
      </Text>
    </View>
  );
}

/** Three dots, for the gap between sending and the first token. */
export function TypingBubble() {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      accessibilityLabel="The coach is typing"
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.tint.iris.bg,
        borderRadius: radius.lg,
        borderBottomLeftRadius: radius.sm,
        borderCurve: 'continuous',
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
      }}
    >
      <Text role="body" color={theme.tint.iris.muted}>
        ● ● ●
      </Text>
    </Animated.View>
  );
}

/** Wraps a suggestion so an empty thread has somewhere to start. */
export function SuggestionChip({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        paddingHorizontal: space.lg,
        paddingVertical: space.md - 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: theme.color.border,
        backgroundColor: theme.color.surface,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text role="caption" color={theme.color.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}
