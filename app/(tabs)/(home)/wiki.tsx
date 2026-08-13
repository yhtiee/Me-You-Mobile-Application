import { useState } from 'react';
import { View } from 'react-native';

import { ArcGauge } from '@/components/ui/arc-gauge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useWiki, type WikiSlot } from '@/hooks/use-wiki';
import { palette, space } from '@/constants/tokens';

/** Keeps the 48px target while narrowing the button enough to sit two in a row. */
const compactAction = { paddingHorizontal: space.xxl, paddingVertical: space.md } as const;

/**
 * Partner cheat-sheet (PRD Module 3).
 *
 * Every slot always renders, filled or not — that is the point of the screen.
 * An unfilled slot is the prompt; hiding it until it has a value would mean the
 * only people who see "Ring size" are the ones who already knew to look.
 */
export default function Wiki() {
  const theme = useTheme();
  const { partnerName, hasPartner, sections, filledCount, total, loading, error, refetch, save } =
    useWiki();

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (loading) return <WikiSkeleton />;

  if (error) {
    return (
      <Screen gap={space.xl}>
        <ErrorState message={error} onRetry={refetch} />
      </Screen>
    );
  }

  const commit = (slot: WikiSlot) => {
    if (draft.trim() !== slot.value.trim()) save(slot, draft);
    setEditing(null);
  };

  /**
   * Opening a second row keeps what you typed in the first.
   *
   * The field used to save on blur, which made tapping anywhere a commit — no
   * Cancel was possible, because pressing it would have blurred and saved
   * first. Now that saving is explicit, this is the one case worth keeping from
   * that behaviour: moving between rows is not a decision to discard.
   */
  const openEditor = (slot: WikiSlot) => {
    const active = editing ? sections.flatMap((s) => s.slots).find((s) => s.label === editing) : null;
    if (active) commit(active);
    setDraft(slot.value);
    setEditing(slot.label);
  };

  return (
    <Screen gap={space.xl}>
      <Card style={{ backgroundColor: theme.tint.iris.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ArcGauge
            value={total ? filledCount / total : 0}
            size={52}
            stroke={5}
            color={palette.person.partner}
            fill={theme.tint.iris.bg}
          >
            <Text role="cardTitle" tabular color={theme.tint.iris.fg}>
              {filledCount}
            </Text>
          </ArcGauge>

          <View style={{ flex: 1, gap: space.xs }}>
            <Text role="cardTitle" color={theme.tint.iris.fg}>
              Everything about {partnerName}
            </Text>
            <Text role="caption" color={theme.tint.iris.muted}>
              {filledCount} of {total} filled in. Tap any line to change it.
            </Text>
          </View>
        </View>
      </Card>

      {!hasPartner ? (
        <Text role="body" color={theme.color.textSecondary}>
          Once your partner joins the hub, this is where you keep the things worth remembering
          about them.
        </Text>
      ) : (
        sections.map((section) => (
          <View key={section.category} style={{ gap: space.sm }}>
            <Text role="overline" color={theme.color.textTertiary}>
              {section.title}
            </Text>
            <Card padded={false} style={{ paddingHorizontal: space.lg }}>
              {section.slots.map((slot, i) => {
                const last = i === section.slots.length - 1;

                if (editing === slot.label) {
                  return (
                    <View key={slot.label} style={{ paddingVertical: space.md, gap: space.md }}>
                      <TextField
                        label={slot.label}
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Nothing here yet"
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => commit(slot)}
                      />

                      {/* An explicit pair, because there was no visible way to
                          finish before this — the keyboard's return key and a
                          tap on empty space were the whole vocabulary, and
                          neither is something a person is told about. */}
                      <View
                        style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' }}
                      >
                        <Button
                          label="Cancel"
                          variant="neutral"
                          style={compactAction}
                          onPress={() => setEditing(null)}
                        />
                        <Button
                          label="Save"
                          style={compactAction}
                          onPress={() => commit(slot)}
                        />
                      </View>
                    </View>
                  );
                }

                return (
                  <ListRow
                    key={slot.label}
                    label={slot.label}
                    value={slot.value || 'Not set'}
                    last={last}
                    onPress={() => openEditor(slot)}
                  />
                );
              })}
            </Card>
          </View>
        ))
      )}

      {/* The old screen printed "✓ means it's saved for offline" next to a flag
          that was never persisted anywhere. The PRD's offline requirement is
          real and unbuilt; a tick claiming otherwise was worse than silence. */}
      <Text role="caption" center color={theme.color.textTertiary}>
        Notes here are private to the two of you.
      </Text>
    </Screen>
  );
}

function WikiSkeleton() {
  const theme = useTheme();

  return (
    <Screen gap={space.xl}>
      <Card style={{ backgroundColor: theme.tint.iris.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Skeleton width={52} height={52} round={26} color="rgba(255,255,255,0.65)" />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton width="70%" height={14} color="rgba(255,255,255,0.65)" />
            <Skeleton width="45%" height={10} color="rgba(255,255,255,0.65)" />
          </View>
        </View>
      </Card>

      {[0, 1].map((section) => (
        <View key={section} style={{ gap: space.sm }}>
          <Skeleton width={80} height={10} />
          <Card style={{ gap: space.lg }}>
            {[0, 1, 2].map((row) => (
              <View
                key={row}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.lg }}
              >
                <Skeleton width={96} height={14} />
                <Skeleton width={72} height={14} />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
