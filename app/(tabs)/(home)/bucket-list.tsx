import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ArcGauge } from '@/components/ui/arc-gauge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckIcon } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { AdSlot } from '@/components/ui/ad-slot';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/components/providers/auth-provider';
import { useRelationship } from '@/hooks/use-relationship';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { addBucketItem } from '@/lib/us';
import { layout, palette, radius, space } from '@/constants/tokens';

/**
 * Copy, not data — the same role `PRESETS` plays on the add-goal screen. An
 * empty list is the hardest thing to start, and these are the four the mock
 * used to ship as fake rows, which is a much better use for them.
 */
const SUGGESTIONS = [
  'Santorini at sunset',
  'Learn to cook jollof properly',
  'Road trip with no plan',
  'Matching tattoos (maybe)',
];

/**
 * Rotated per item so the list reads as a set of things, not a spreadsheet.
 *
 * The tick colours are brand hues, which are the same in both schemes; the
 * fills come from the theme's tints, which are not — so they are resolved
 * inside the row rather than here.
 */
const TINT_ORDER = ['rose', 'iris', 'amber'] as const;
const TICKS = [palette.brand.rose, palette.brand.iris, palette.brand.amber];

/**
 * Shared private list (PRD Module 3).
 *
 * Split into what is still ahead and what has been ticked off, because those
 * are two different things to look at: the top half is the point of the list
 * and the bottom half is the reward for keeping it. A single flat checklist
 * with the done items greyed out in place buries the former in the latter.
 */
export default function BucketList() {
  const theme = useTheme();
  const toast = useToast();
  const { user, coupleId } = useAuth();
  const { view, loading, error, refetch, toggleBucketItem } = useRelationship();

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async (label: string) => {
    if (!label.trim()) return;

    if (!user || !coupleId) {
      toast.error('Your session ended. Log in again to continue.');
      return;
    }

    setSaving(true);
    try {
      await addBucketItem({ coupleId, userId: user.id, label: label.trim() });
      setDraft('');
      refetch();
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t add that.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (item: { id: string; label: string; done: boolean }) => {
    // Only on the way *in*. A success buzz for un-ticking something would be
    // congratulating the user for undoing an achievement.
    if (!item.done && process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    toggleBucketItem(item);
  };

  if (loading) return <BucketSkeleton />;

  if (!view) {
    return (
      <Screen gap={space.xl}>
        <ErrorState message={error ?? 'We couldn’t load your list.'} onRetry={refetch} />
      </Screen>
    );
  }

  const todo = view.bucket.filter((item) => !item.done);
  const done = view.bucket.filter((item) => item.done);
  const total = view.bucket.length;

  return (
    <Screen gap={space.xl}>
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ArcGauge
            value={total ? done.length / total : 0}
            size={64}
            stroke={7}
            color={palette.brand.rose}
          >
            <Text role="title3" tabular color={palette.brand.rose}>
              {done.length}
            </Text>
          </ArcGauge>

          <View style={{ flex: 1, gap: space.xs }}>
            <Text role="cardTitle">{headline(total, done.length)}</Text>
            <Text role="caption" color={theme.color.textSecondary}>
              {subhead(total, done.length)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Suggestions stay until the list can stand on its own. Four chips under
          an empty card is a first move; four chips under a list of twelve is
          clutter. */}
      {total < 3 ? (
        <View style={{ gap: space.sm }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Need a starting point?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {SUGGESTIONS.filter(
              (s) => !view.bucket.some((item) => item.label.toLowerCase() === s.toLowerCase())
            ).map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                accessibilityLabel={`Add ${suggestion}`}
                disabled={saving}
                onPress={() => void add(suggestion)}
                style={({ pressed }) => ({
                  paddingHorizontal: space.lg - 2,
                  paddingVertical: space.sm + 1,
                  borderRadius: radius.pill,
                  backgroundColor: theme.tint.rose.bg,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text role="caption" color={theme.tint.rose.fg}>
                  + {suggestion}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: space.md }}>
        <TextField
          label="Add something"
          placeholder="Somewhere you both want to go…"
          value={draft}
          onChangeText={setDraft}
          returnKeyType="done"
          onSubmitEditing={() => void add(draft)}
        />
        <Button
          label={saving ? 'Adding…' : 'Add to the list'}
          full
          disabled={!draft.trim() || saving}
          onPress={() => void add(draft)}
        />
      </View>

      {todo.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Still ahead of you · {todo.length}
          </Text>
          <View style={{ gap: space.sm }}>
            {todo.map((item, i) => (
              <BucketRow key={item.id} item={item} index={i} onToggle={() => toggle(item)} />
            ))}
          </View>
        </View>
      ) : null}

      {done.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Ticked off · {done.length}
          </Text>
          <View style={{ gap: space.sm }}>
            {done.map((item, i) => (
              <BucketRow key={item.id} item={item} index={i} onToggle={() => toggle(item)} />
            ))}
          </View>
        </View>
      ) : null}

      <Text role="caption" center color={theme.color.textTertiary}>
        Only the two of you can see this list. No deadlines on any of it.
      </Text>

      {/* An empty list is an empty screen; AdMob does not allow ads there. */}
      <AdSlot show={todo.length + done.length > 0} />
    </Screen>
  );
}

/**
 * One thing you said you'd do one day.
 *
 * Deliberately not `CheckboxRow`: that component is a compact form control for
 * lists of settings, and this is the content of the screen. The tick is a 30px
 * circle you can hit without aiming, the whole row is the target, and a done
 * item drops its colour and rules itself through rather than just dimming —
 * crossing something out is the entire pleasure of a list like this.
 */
function BucketRow({
  item,
  index,
  onToggle,
}: {
  item: { id: string; label: string; done: boolean };
  index: number;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const tick = TICKS[index % TICKS.length];

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.done }}
      accessibilityLabel={item.label}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: layout.minTarget + 8,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: item.done
          ? theme.color.surfaceSunken
          : theme.tint[TINT_ORDER[index % TINT_ORDER.length]].bg,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: item.done ? 0 : 2,
          borderColor: tick,
          backgroundColor: item.done ? theme.color.textTertiary : 'transparent',
        }}
      >
        {item.done ? <CheckIcon size={18} color="#FFFFFF" /> : null}
      </View>

      <Text
        role="bodyStrong"
        style={[{ flex: 1 }, item.done && { textDecorationLine: 'line-through' }]}
        color={item.done ? theme.color.textTertiary : theme.color.textPrimary}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function headline(total: number, done: number): string {
  if (total === 0) return 'Nothing on the list yet';
  if (done === 0) return `${total} waiting on you`;
  if (done === total) return 'All of them. Every one.';
  return `${done} of ${total} ticked off`;
}

function subhead(total: number, done: number): string {
  if (total === 0) return 'The things you keep saying you’ll do one day. Put the first one down.';
  if (done === 0) return 'Start with the easy one. It counts the same.';
  if (done === total) return 'Time to think of something new.';
  return `${total - done} still ahead of you.`;
}

function BucketSkeleton() {
  return (
    <Screen gap={space.xl}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Skeleton width={64} height={64} round={32} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="75%" height={10} />
          </View>
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        <Skeleton width={96} height={10} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={62} round={radius.lg} />
        ))}
      </View>
    </Screen>
  );
}
