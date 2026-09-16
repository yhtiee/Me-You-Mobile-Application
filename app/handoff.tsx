import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Pressable, ScrollView, Share, View } from 'react-native';

import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

import { SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { partnerNameInSentence, useCouplePeople } from '@/hooks/use-couple-people';
import { useNudges } from '@/hooks/use-nudges';
import { useTheme } from '@/components/providers/theme-provider';
import { NUDGE_CHANNELS, type NudgeChannel } from '@/constants/nudges';
import { layout, radius, space } from '@/constants/tokens';

/**
 * Check-in reminder box hand-off (PRD Module 1): jump straight into a chat.
 *
 * Three things changed from the version that was three unlabelled rows.
 *
 * 1. Six apps instead of three, from `constants/nudges.ts`.
 * 2. Each carries a **nudge** — a message you could send verbatim. The old
 *    sheet answered "where" and left "what do I say" to someone who had already
 *    told us they were stuck, which is the harder half.
 * 3. Each carries a **tick** that persists for the day, so tomorrow's sheet
 *    starts blank and today's remembers.
 *
 * Opening an app and ticking it are separate taps, deliberately. You can open
 * WhatsApp and send nothing; a checklist that marks itself as you browse is one
 * that lies to the person relying on it.
 *
 * None of these schemes resolve in a simulator, so every one falls back to the
 * share sheet rather than throwing.
 */
export default function Handoff() {
  const theme = useTheme();
  const people = useCouplePeople();
  const { isSent, toggle, count } = useNudges();

  const open = async (channel: NudgeChannel) => {
    try {
      const supported = await Linking.canOpenURL(channel.scheme);
      if (supported) await Linking.openURL(channel.scheme);
      else await Share.share({ message: channel.nudge });
    } catch {
      await Share.share({ message: channel.nudge });
    }
  };

  return (
    <SheetBody
      title={`Say something to ${partnerNameInSentence(people)}`}
      subtitle={
        count > 0
          ? `You’ve marked ${count} today. Anything else is a bonus.`
          : 'No script needed — tap a line to use it as-is.'
      }
    >
      {/* Scrolls, because six rows with two lines each outgrow the sheet at
          larger text sizes even at the raised detent. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {NUDGE_CHANNELS.map((channel) => (
          <ChannelRow
            key={channel.key}
            channel={channel}
            sent={isSent(channel.key)}
            onOpen={() => void open(channel)}
            onToggle={() => void toggle(channel.key)}
          />
        ))}
      </ScrollView>

      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text role="caption" center color={theme.color.textSecondary}>
          Done
        </Text>
      </Pressable>
    </SheetBody>
  );
}

/**
 * The app's own mark on its own colour.
 *
 * A rounded square rather than a circle, because that is the shape a phone
 * home screen has trained everyone to read as "an app". The glyph is inset
 * enough that the tile reads as a container rather than a coloured backing
 * plate — FontAwesome's brand marks are drawn to the full em box, so at tile
 * size they need the padding an app icon's own artwork already has.
 */
function ChannelMark({ channel }: { channel: NudgeChannel }) {
  return (
    <View
      style={{
        width: MARK,
        height: MARK,
        borderRadius: radius.md - 2,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: channel.fill,
        experimental_backgroundImage: channel.gradient,
      }}
    >
      <FontAwesome6
        name={channel.icon}
        iconStyle={channel.iconStyle}
        size={19}
        color={channel.ink}
      />
    </View>
  );
}

/** Tile side. Matches the 36px header circle rather than inventing a size. */
const MARK = 36;

/**
 * One app: mark, name, the suggested line, and the day's tick.
 *
 * The row body and the tick are two separate pressables inside one bordered
 * container rather than a row with a trailing button, so each gets its own
 * accessible role — "open Instagram" is a button, "messaged on Instagram" is a
 * checkbox — instead of one control that does two things depending on where
 * your thumb lands.
 */
function ChannelRow({
  channel,
  sent,
  onOpen,
  onToggle,
}: {
  channel: NudgeChannel;
  sent: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        // A ticked row recedes: the border and fill go to the success tint so
        // what is left undone is what stands out.
        borderColor: sent ? theme.tint.success.bg : theme.color.border,
        backgroundColor: sent ? theme.tint.success.bg : theme.color.surface,
        paddingLeft: space.lg,
        paddingRight: space.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${channel.label}`}
        accessibilityHint={channel.nudge}
        onPress={onOpen}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: layout.minTarget + 10,
          paddingVertical: space.md,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ChannelMark channel={channel} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text role="bodyStrong">{channel.label}</Text>
          <Text
            role="caption"
            color={sent ? theme.tint.success.muted : theme.color.textSecondary}
          >
            “{channel.nudge}”
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: sent }}
        accessibilityLabel={`Messaged ${channel.label} today`}
        onPress={() => {
          if (process.env.EXPO_OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onToggle();
        }}
        hitSlop={8}
        style={{
          width: layout.minTarget,
          minHeight: layout.minTarget,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.sm - 1,
            borderCurve: 'continuous',
            borderWidth: sent ? 0 : 1.5,
            borderColor: theme.color.border,
            // `theme.color.success`, not `palette.light.success` — the latter is
            // the light-mode literal and would stay pale green on a dark sheet.
            backgroundColor: sent ? theme.color.success : theme.color.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {sent ? (
            <Text role="caption" color="#FFFFFF">
              ✓
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
