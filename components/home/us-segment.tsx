import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ArcGauge } from '@/components/ui/arc-gauge';
import { Card } from '@/components/ui/card';
import { CheckIcon, ChevronIcon, PlusIcon } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useRelationship, type LoveLanguageRow, type UsView } from '@/hooks/use-relationship';
import { useTheme } from '@/components/providers/theme-provider';
import { AdSlot } from '@/components/ui/ad-slot';
import { icon, layout, palette, radius, space } from '@/constants/tokens';
import type { UsGoal } from '@/lib/us';

/**
 * Love languages, shared goals, bucket list, wiki entry point, health.
 *
 * Every number here is a row in Postgres. The three things that used to be
 * decoration are now doing work: the health figure shows the three inputs it is
 * made of, goals count up rather than only being ticked off, and the love
 * languages are a comparison between two people instead of two lists side by
 * side that nobody was going to read across.
 */
export function UsSegment() {
  const { view, error, loading, refetch, logGoalProgress, toggleGoal } = useRelationship();

  if (loading) return <UsSkeleton />;

  if (!view) {
    return <ErrorState message={error ?? 'We couldn’t load this.'} onRetry={refetch} />;
  }

  return <UsContent view={view} onLogProgress={logGoalProgress} onToggleGoal={toggleGoal} />;
}

function UsContent({
  view,
  onLogProgress,
  onToggleGoal,
}: {
  view: UsView;
  onLogProgress: (goal: UsGoal) => void;
  onToggleGoal: (goal: UsGoal) => void;
}) {
  const theme = useTheme();

  return (
    <>
      <HealthCard view={view} />

      <WikiCard filled={view.wikiFilled} total={view.wikiTotal} partnerName={view.partnerName} />

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <SectionHeader
          title={`Shared goals · ${view.goalsDone} done`}
          action="+ Add"
          onPress={() => router.push('/add-goal')}
        />

        <Card style={{ gap: space.lg }}>
          {view.goals.length === 0 ? (
            <EmptyState label="+ Set your first goal" onPress={() => router.push('/add-goal')} />
          ) : (
            view.goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onLogProgress={() => onLogProgress(goal)}
                onToggle={() => onToggleGoal(goal)}
              />
            ))
          )}
        </Card>
      </View>

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <SectionHeader
          title="Love languages"
          action={view.loveLanguagesUnset ? undefined : 'Edit yours'}
          onPress={() => router.push('/love-languages')}
        />

        {view.loveLanguagesUnset ? (
          <EmptyState
            label="+ Rate what makes you feel loved"
            onPress={() => router.push('/love-languages')}
          />
        ) : (
          <Card style={{ gap: space.lg }}>
            <View style={{ flexDirection: 'row', gap: space.lg }}>
              <Legend color={palette.person.you} label="You" />
              <Legend color={palette.person.partner} label={view.partnerName} />
            </View>

            {view.loveLanguages.map((language) => (
              <CompareRow key={language.key} language={language} partnerName={view.partnerName} />
            ))}
          </Card>
        )}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/bucket-list')}>
        <Card style={{ gap: space.md }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text role="cardTitle">Bucket list</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text role="caption" tabular color={theme.color.textSecondary}>
                {view.bucketDone} of {view.bucket.length}
              </Text>
              <ChevronIcon size={icon.sm} color={theme.color.textTertiary} />
            </View>
          </View>

          {view.bucket.length === 0 ? (
            <Text role="caption" color={theme.color.textTertiary}>
              Nothing on it yet — somewhere you both want to go, someday.
            </Text>
          ) : (
            // A preview of what is still ahead of them, rather than a bare
            // count. The count says how much is left; this says what it is.
            <View style={{ gap: space.xs }}>
              {view.bucket
                .filter((item) => !item.done)
                .slice(0, 2)
                .map((item) => (
                  <Text key={item.id} role="caption" color={theme.color.textSecondary} numberOfLines={1}>
                    · {item.label}
                  </Text>
                ))}
            </View>
          )}
        </Card>
      </Pressable>

      <AdSlot />
    </>
  );
}

/**
 * The health figure, showing its working.
 *
 * The formula is still unreviewed (see `use-relationship`), so the card breaks
 * it into the three things it is made of. A percentage nobody can account for
 * is a number people learn to ignore; one that says "47-day streak, both of you
 * in today, 2 of 4 goals" is a number they can act on.
 */
function HealthCard({ view }: { view: UsView }) {
  const theme = useTheme();

  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
        <ArcGauge value={view.health / 100} size={96} stroke={9} color={palette.brand.rose}>
          <Text role="title2" tabular color={palette.brand.rose}>
            {view.health}
            <Text role="caption" color={theme.color.textTertiary}>
              %
            </Text>
          </Text>
        </ArcGauge>

        <View style={{ flex: 1, gap: space.md }}>
          <Text role="cardTitle">Relationship health</Text>
          {view.healthParts.map((part) => (
            <View key={part.label} style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text role="caption" color={theme.color.textSecondary}>
                  {part.label}
                </Text>
                <Text role="caption" tabular color={theme.color.textTertiary}>
                  {part.value}
                </Text>
              </View>
              <Bar value={part.share} color={palette.brand.rose} />
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

function WikiCard({
  filled,
  total,
  partnerName,
}: {
  filled: number;
  total: number;
  partnerName: string;
}) {
  const theme = useTheme();

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/wiki')}>
      <Card style={{ backgroundColor: theme.tint.iris.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ArcGauge
            value={total ? filled / total : 0}
            size={52}
            stroke={5}
            color={palette.person.partner}
            fill={theme.tint.iris.bg}
          >
            <Text role="cardTitle" tabular color={theme.tint.iris.fg}>
              {filled}
            </Text>
          </ArcGauge>

          <View style={{ flex: 1, gap: space.xs }}>
            <Text role="overline" color={palette.person.partner}>
              Partner wiki
            </Text>
            <Text role="cardTitle" color={theme.tint.iris.fg}>
              {filled} of {total} things you know about {partnerName}
            </Text>
            <Text role="caption" color={theme.tint.iris.muted}>
              Ring size, the flowers, the dream trip.
            </Text>
          </View>

          <ChevronIcon size={icon.sm} color={theme.tint.iris.muted} />
        </View>
      </Card>
    </Pressable>
  );
}

/**
 * A goal, with the increment button that makes it a habit rather than a wish.
 *
 * The `+` is the primary verb — one tap logs one date, one movie, one day — and
 * the row itself still toggles done for the goals that are not really counters.
 * Two targets on one row is a real risk, so the `+` is a raised circle and the
 * row is flat; they do not look like the same control.
 */
function GoalRow({
  goal,
  onLogProgress,
  onToggle,
}: {
  goal: UsGoal;
  onLogProgress: () => void;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const progress = goal.done ? 1 : Math.min(1, goal.target ? goal.current / goal.target : 0);
  const unit = goal.unit ? ` ${goal.unit}` : '';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${goal.label}, ${goal.current} of ${goal.target}${unit}`}
        accessibilityHint={goal.done ? 'Marks it unfinished' : 'Marks it finished'}
        onPress={onToggle}
        style={{ flex: 1, gap: space.sm }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <Text
            role="bodyStrong"
            style={{ flex: 1 }}
            color={goal.done ? theme.color.textTertiary : theme.color.textPrimary}
          >
            {goal.label}
          </Text>
          <Text
            role="caption"
            tabular
            color={goal.done ? theme.color.success : theme.color.textSecondary}
          >
            {goal.done ? 'Done' : `${goal.current}/${goal.target}${unit}`}
          </Text>
        </View>
        <Bar
          value={progress}
          color={goal.done ? theme.color.success : palette.brand.amber}
          height={6}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={goal.done ? `${goal.label} is done` : `Add one to ${goal.label}`}
        disabled={goal.done}
        onPress={onLogProgress}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: goal.done ? 'transparent' : theme.tint.amber.bg,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        {goal.done ? (
          <CheckIcon size={icon.sm} color={theme.color.success} />
        ) : (
          <PlusIcon size={icon.sm} color={theme.tint.amber.muted} />
        )}
      </Pressable>
    </View>
  );
}

/**
 * One love language, both people, stacked.
 *
 * The old design was two cards side by side showing each person's top three.
 * Nobody reads across two lists to notice that one of you cares about words
 * twice as much as the other — which is the single most useful thing this
 * screen can tell a couple, so it is now the thing the layout says first.
 */
function CompareRow({
  language,
  partnerName,
}: {
  language: LoveLanguageRow;
  partnerName: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${language.label}. You ${language.you} percent, ${partnerName} ${language.partner} percent.`}
      style={{ gap: space.sm }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text role="caption" style={{ flex: 1 }} color={theme.color.textPrimary} numberOfLines={1}>
          {language.label}
        </Text>
        <Text role="caption" tabular color={theme.color.textTertiary}>
          {language.you}% · {language.partner}%
        </Text>
      </View>
      <View style={{ gap: 3 }}>
        <Bar value={language.you / 100} color={palette.person.you} height={5} />
        <Bar value={language.partner / 100} color={palette.person.partner} height={5} />
      </View>
    </View>
  );
}

/**
 * A plain bar.
 *
 * Not `ProgressBar`: this screen draws thirteen of them, and that component
 * announces itself as a progressbar and animates on mount. Thirteen animated
 * accessibility nodes describing a single card is noise in both senses — these
 * are read out by the row they belong to instead.
 */
function Bar({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  const theme = useTheme();

  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.color.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm - 2 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text role="overline" color={theme.color.textSecondary} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text role="overline" color={theme.color.textTertiary}>
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          hitSlop={8}
          style={{ minHeight: layout.minTarget / 2, justifyContent: 'center' }}
        >
          <Text role="caption" color={palette.brand.rose}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** First paint, laid out to the same five blocks. */
function UsSkeleton() {
  const theme = useTheme();

  return (
    <>
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
          <Skeleton width={96} height={96} round={48} />
          <View style={{ flex: 1, gap: space.md }}>
            <Skeleton width={140} height={14} />
            <Skeleton height={6} round={3} />
            <Skeleton height={6} round={3} />
            <Skeleton height={6} round={3} />
          </View>
        </View>
      </Card>

      <Card style={{ backgroundColor: theme.tint.iris.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Skeleton width={52} height={52} round={26} color="rgba(255,255,255,0.65)" />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton width={72} height={10} color="rgba(255,255,255,0.65)" />
            <Skeleton width="80%" height={14} color="rgba(255,255,255,0.65)" />
          </View>
        </View>
      </Card>

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Shared goals
        </Text>
        <Card style={{ gap: space.lg }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ gap: space.sm }}>
              <Skeleton width="70%" height={14} />
              <Skeleton height={6} round={3} />
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Love languages
        </Text>
        <Card style={{ gap: space.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ gap: space.sm }}>
              <Skeleton width="55%" height={12} />
              <Skeleton height={5} round={3} />
              <Skeleton height={5} round={3} />
            </View>
          ))}
        </Card>
      </View>
    </>
  );
}
