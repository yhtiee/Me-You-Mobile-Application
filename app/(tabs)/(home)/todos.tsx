import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ArcGauge } from '@/components/ui/arc-gauge';
import { Card } from '@/components/ui/card';
import { CheckIcon, ChevronIcon, CloseIcon, PlusIcon } from '@/components/ui/icons';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useRelationship } from '@/hooks/use-relationship';
import { useTheme } from '@/components/providers/theme-provider';
import { useTodos } from '@/hooks/use-todos';
import { icon, layout, palette, radius, space } from '@/constants/tokens';
import type { Todo } from '@/types/domain';

/**
 * Was the "Just for you" card at the bottom of Today; now a pushed screen
 * behind its quick action.
 *
 * Two lists live under this action and they are not the same kind of thing:
 * these reminders are private to whoever wrote them, and the bucket list is
 * shared. They stay separate screens for exactly that reason — one merged list
 * would have to explain, per row, who can see it — but the bucket list is
 * reachable from here, because "things I mean to do" is where a person comes
 * looking for it.
 *
 * The composer sits at the top rather than the bottom. Adding is what people
 * come to a to-do list to do, far more often than reading it.
 */
export default function Todos() {
  const theme = useTheme();
  const { open, done, loading, error, refetch, add, toggle, remove, clearDone } = useTodos();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const submit = async () => {
    if (!draft.trim() || adding) return;
    setAdding(true);
    const ok = await add(draft);
    if (ok) setDraft('');
    setAdding(false);
  };

  const tick = (todo: Todo) => {
    if (!todo.done && process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    toggle(todo);
  };

  if (loading) return <TodosSkeleton />;

  if (error) {
    return (
      <Screen gap={space.xl}>
        <ErrorState message={error} onRetry={refetch} />
      </Screen>
    );
  }

  const total = open.length + done.length;

  return (
    <Screen gap={space.xl}>
      <Card style={{ gap: space.lg, backgroundColor: theme.tint.rose.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ArcGauge
            value={total ? done.length / total : 0}
            size={58}
            stroke={6}
            color={palette.brand.rose}
            fill={theme.tint.rose.bg}
          >
            <Text role="cardTitle" tabular color={theme.tint.rose.fg}>
              {open.length}
            </Text>
          </ArcGauge>

          <View style={{ flex: 1, gap: space.xs }}>
            <Text role="cardTitle" color={theme.tint.rose.fg}>
              {headline(total, open.length)}
            </Text>
            <Text role="caption" color={theme.tint.rose.muted}>
              Private. Nobody else sees this list — not even your partner.
            </Text>
          </View>
        </View>

        {/*
         * One pill per reminder, filled as they are ticked. A number says how
         * many are left; this says how much of the list that is, which is the
         * question you actually have at a glance.
         */}
        {total > 0 ? (
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {[...open, ...done].map((todo) => (
              <View
                key={todo.id}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: todo.done ? palette.brand.rose : 'rgba(255,255,255,0.75)',
                }}
              />
            ))}
          </View>
        ) : null}
      </Card>

      <Composer
        value={draft}
        onChangeText={setDraft}
        onSubmit={() => void submit()}
        busy={adding}
      />

      {total === 0 ? (
        <View style={{ gap: space.sm, alignItems: 'center', paddingVertical: space.xl }}>
          <Text role="title3" color={theme.color.textSecondary}>
            Nothing on your list
          </Text>
          <Text role="caption" center color={theme.color.textTertiary}>
            The small things you keep meaning to do — book the table, call your mum, buy the
            batteries.
          </Text>
        </View>
      ) : null}

      {open.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text role="overline" color={theme.color.textTertiary}>
            To do · {open.length}
          </Text>
          <Card padded={false} style={{ paddingHorizontal: space.md, paddingVertical: space.xs }}>
            {open.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={() => tick(todo)} onRemove={() => remove(todo)} />
            ))}
          </Card>
        </View>
      ) : null}

      {done.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text role="overline" color={theme.color.textTertiary}>
              Done · {done.length}
            </Text>
            <Pressable accessibilityRole="button" onPress={clearDone} hitSlop={10}>
              <Text role="caption" color={palette.brand.rose}>
                Clear
              </Text>
            </Pressable>
          </View>
          <Card padded={false} style={{ paddingHorizontal: space.md, paddingVertical: space.xs }}>
            {done.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={() => tick(todo)} onRemove={() => remove(todo)} />
            ))}
          </Card>
        </View>
      ) : null}

      <BucketListCard />
    </Screen>
  );
}

/**
 * Field and button on one line, inside a single surface.
 *
 * A labelled field over a full-width "Add" button is a form; this is a
 * composer, and it should look like the one-line thing it is. The field's own
 * border and fill are stripped so the card is the input.
 */
function Composer({
  value,
  onChangeText,
  onSubmit,
  busy,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const ready = value.trim().length > 0 && !busy;

  return (
    <Card
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.sm,
        paddingLeft: space.lg - 2,
      }}
    >
      <View style={{ flex: 1 }}>
        <TextField
          placeholder="Add a reminder…"
          value={value}
          onChangeText={onChangeText}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={{
            borderWidth: 0,
            backgroundColor: 'transparent',
            paddingHorizontal: 0,
          }}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add reminder"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={onSubmit}
        style={({ pressed }) => ({
          width: layout.minTarget - 4,
          height: layout.minTarget - 4,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ready ? palette.brand.rose : theme.color.surfaceSunken,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <PlusIcon size={icon.md} color={ready ? '#FFFFFF' : theme.color.textTertiary} />
      </Pressable>
    </Card>
  );
}

/**
 * One reminder.
 *
 * The delete is always visible rather than hidden behind a swipe. A swipe is
 * undiscoverable and these are throwaway items — "buy the batteries" is dead
 * the moment it is done — so removing one should not be the hard path. It is a
 * low-contrast × so it never competes with the tick.
 */
function TodoRow({
  todo,
  onToggle,
  onRemove,
}: {
  todo: Todo;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.done }}
        accessibilityLabel={todo.label}
        onPress={onToggle}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: layout.minTarget,
          paddingVertical: space.xs,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: todo.done ? 0 : 2,
            borderColor: palette.brand.rose,
            backgroundColor: todo.done ? palette.brand.rose : 'transparent',
          }}
        >
          {todo.done ? <CheckIcon size={16} color="#FFFFFF" /> : null}
        </View>

        <Text
          role="bodyStrong"
          style={[{ flex: 1 }, todo.done && { textDecorationLine: 'line-through' }]}
          color={todo.done ? theme.color.textTertiary : theme.color.textPrimary}
        >
          {todo.label}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${todo.label}`}
        onPress={onRemove}
        hitSlop={10}
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <CloseIcon size={icon.sm} color={theme.color.textTertiary} />
      </Pressable>
    </View>
  );
}

/**
 * The shared list, one tap away.
 *
 * Carries its real progress rather than being a bare link — a row that only
 * says "Bucket list ›" is a thing you tap once out of curiosity, and a row that
 * says "2 of 6 ticked off" is a thing you tap because you want to know what the
 * other four are.
 */
function BucketListCard() {
  const theme = useTheme();
  const { view, loading } = useRelationship();

  const total = view?.bucket.length ?? 0;
  const done = view?.bucketDone ?? 0;

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/bucket-list')}>
      <Card style={{ backgroundColor: theme.tint.iris.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          {loading ? (
            <Skeleton width={52} height={52} round={26} color="rgba(255,255,255,0.65)" />
          ) : (
            <ArcGauge
              value={total ? done / total : 0}
              size={52}
              stroke={5}
              color={palette.person.partner}
              fill={theme.tint.iris.bg}
            >
              <Text role="cardTitle" tabular color={theme.tint.iris.fg}>
                {done}
              </Text>
            </ArcGauge>
          )}

          <View style={{ flex: 1, gap: space.xs }}>
            <Text role="overline" color={palette.person.partner}>
              Both of you
            </Text>
            <Text role="cardTitle" color={theme.tint.iris.fg}>
              Bucket list
            </Text>
            {loading ? (
              <Skeleton width="70%" height={10} color="rgba(255,255,255,0.65)" />
            ) : (
              <Text role="caption" color={theme.tint.iris.muted}>
                {total === 0
                  ? 'Nothing on it yet — the shared one.'
                  : `${done} of ${total} ticked off together.`}
              </Text>
            )}
          </View>

          <ChevronIcon size={icon.sm} color={theme.tint.iris.muted} />
        </View>
      </Card>
    </Pressable>
  );
}

function headline(total: number, open: number): string {
  if (total === 0) return 'Nothing to do';
  if (open === 0) return 'All clear';
  return open === 1 ? '1 thing left' : `${open} things left`;
}

function TodosSkeleton() {
  const theme = useTheme();

  return (
    <Screen gap={space.xl}>
      <Card style={{ gap: space.lg, backgroundColor: theme.tint.rose.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Skeleton width={58} height={58} round={29} color="rgba(255,255,255,0.7)" />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton width="45%" height={14} color="rgba(255,255,255,0.7)" />
            <Skeleton width="85%" height={10} color="rgba(255,255,255,0.7)" />
          </View>
        </View>
        <Skeleton height={6} round={3} color="rgba(255,255,255,0.7)" />
      </Card>

      <Skeleton height={62} round={radius.lg} />

      <View style={{ gap: space.sm }}>
        <Skeleton width={72} height={10} />
        <Card style={{ gap: space.lg }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Skeleton width={26} height={26} round={13} />
              <Skeleton width={`${72 - i * 12}%`} height={14} />
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
