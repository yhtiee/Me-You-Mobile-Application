import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useTogether } from '@/hooks/use-together';
import { space } from '@/constants/tokens';
import { todayIso } from '@/utils/date';

/**
 * How long you have been together — the input that never existed.
 *
 * `couples.together_since` has been in the schema since 0002 and writable since
 * 0007, but nothing ever set it: `create_couple()` accepts it and onboarding
 * never passes one. So the home banner has been reading null and showing "Just
 * getting started" for every couple, permanently.
 *
 * Two ways in, deliberately. The number of years is what people know off the
 * top of their head and is what was asked for; the exact date is what the
 * banner actually renders ("2 years, 4 months"), and only a date can produce
 * that. The years field writes `today − N years`, which is lossy in the one
 * direction where the user can see the result and correct it underneath.
 */
export function TogetherEditor() {
  const theme = useTheme();
  const { since, label, years, save, saveYears, saving, loading } = useTogether();

  /** Null until typed, so a slow load cannot overwrite what is being entered. */
  const [draftYears, setDraftYears] = useState<string | null>(null);

  const yearsValue = draftYears ?? (years === null ? '' : String(years));
  const parsedYears = Number(yearsValue);
  const yearsValid =
    yearsValue.trim() !== '' && Number.isInteger(parsedYears) && parsedYears >= 0 && parsedYears <= 99;

  if (loading) {
    return (
      <Card style={{ gap: space.md }}>
        <Skeleton width="60%" height={14} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.lg }}>
      <Text role="body" color={theme.color.textSecondary}>
        {label
          ? `Your banner reads “${label}”.`
          : 'Set this and your home banner starts counting.'}
      </Text>

      <View style={{ gap: space.sm }}>
        <TextField
          label="Years together"
          value={yearsValue}
          onChangeText={setDraftYears}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={2}
          placeholder="e.g. 3"
          hint="Rounded to today’s date. Set the exact day below if you know it."
        />
        <Button
          label={saving ? 'Saving…' : 'Save years'}
          variant="secondary"
          full
          disabled={saving || !yearsValid}
          onPress={() => {
            void saveYears(parsedYears).then((ok) => {
              // Drop the draft only on success, so a failed write leaves what
              // they typed in the field rather than snapping back.
              if (ok) setDraftYears(null);
            });
          }}
        />
      </View>

      <View style={{ gap: space.sm }}>
        <DateField
          label="Or the exact day"
          value={since ?? ''}
          onChange={(iso) => {
            setDraftYears(null);
            void save(iso);
          }}
          // You cannot have started in the future, and `durationSince` counts
          // backwards if you had.
          maximumDate={todayIso()}
          hint="This is what the “2 years, 4 months” counter is built from."
        />
      </View>
    </Card>
  );
}
