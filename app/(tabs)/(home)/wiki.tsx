import { useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useWiki } from '@/hooks/use-wiki';
import { palette, space } from '@/constants/tokens';

/** Partner cheat-sheet (PRD Module 3), readable offline. */
export default function Wiki() {
  const theme = useTheme();
  const { partnerName, sections, update } = useWiki();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <Screen gap={space.xl}>
      <Card style={{ gap: space.xs, backgroundColor: palette.brand.irisSoft }}>
        <Text role="cardTitle" color="#3F3161">
          Everything about {partnerName}
        </Text>
        <Text role="caption" color="#6B5C8E">
          Kept on this device too — the sizes and dates still work with no signal.
        </Text>
      </Card>

      {sections.map((section) => (
        <View key={section.category} style={{ gap: space.sm }}>
          <Text role="overline" color={theme.color.textTertiary}>
            {section.title}
          </Text>
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            {section.entries.map((entry, i) => {
              const isEditing = editing === entry.id;
              const last = i === section.entries.length - 1;

              if (isEditing) {
                return (
                  <View key={entry.id} style={{ paddingVertical: space.md, gap: space.sm }}>
                    <TextField
                      label={entry.label}
                      value={draft}
                      onChangeText={setDraft}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        update(entry.id, draft);
                        setEditing(null);
                      }}
                      onBlur={() => {
                        update(entry.id, draft);
                        setEditing(null);
                      }}
                    />
                  </View>
                );
              }

              return (
                <ListRow
                  key={entry.id}
                  label={entry.label}
                  value={entry.value || 'Not set'}
                  last={last}
                  onPress={() => {
                    setDraft(entry.value);
                    setEditing(entry.id);
                  }}
                  right={
                    entry.cachedOffline ? (
                      <Text role="overline" color={theme.color.success}>
                        ✓
                      </Text>
                    ) : undefined
                  }
                />
              );
            })}
          </Card>
        </View>
      ))}

      <Text role="caption" center color={theme.color.textTertiary}>
        ✓ means it’s saved for offline. Notes here are private to the two of you.
      </Text>
    </Screen>
  );
}
