import { useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { CheckboxRow } from '@/components/ui/checkbox-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useCouple } from '@/components/providers/couple-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { space } from '@/constants/tokens';

/** Shared private list (PRD Module 3). */
export default function BucketList() {
  const theme = useTheme();
  const { bucketList, toggleBucketItem } = useCouple();
  const [draft, setDraft] = useState('');

  const done = bucketList.filter((b) => b.done).length;

  return (
    <Screen gap={space.xl}>
      <Text role="body" color={theme.color.textSecondary}>
        {done} of {bucketList.length} done. No deadlines on any of it.
      </Text>

      <Card style={{ gap: space.sm }}>
        {bucketList.length === 0 ? (
          <EmptyState label="+ Add the first one" />
        ) : (
          bucketList.map((item) => (
            <CheckboxRow
              key={item.id}
              label={item.label}
              checked={item.done}
              onToggle={() => toggleBucketItem(item.id)}
            />
          ))
        )}
      </Card>

      <View style={{ gap: space.sm }}>
        <TextField
          label="Add something"
          placeholder="Somewhere you both want to go…"
          value={draft}
          onChangeText={setDraft}
          returnKeyType="done"
          onSubmitEditing={() => setDraft('')}
        />
        <Text role="caption" color={theme.color.textTertiary}>
          Only the two of you can see this list.
        </Text>
      </View>
    </Screen>
  );
}
