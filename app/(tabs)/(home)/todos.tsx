import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckboxRow } from '@/components/ui/checkbox-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useTodos } from '@/hooks/use-todos';
import { space } from '@/constants/tokens';

/**
 * Was the "Just for you" card at the bottom of Today; now a pushed screen
 * behind its quick action.
 *
 * The card's "+ Add a reminder" empty state was a dead label — `useTodos`
 * has always exposed `add` with nothing calling it. With a screen's worth of
 * room, it is wired up.
 */
export default function Todos() {
  const theme = useTheme();
  const { todos, toggle, add, partnerName } = useTodos();
  const [draft, setDraft] = useState('');

  const submit = () => {
    const label = draft.trim();
    if (!label) return;
    add(label);
    setDraft('');
  };

  return (
    <Screen gap={space.md}>
      <Text role="body" color={theme.color.textSecondary}>
        Private — {partnerName} never sees these.
      </Text>

      <Card style={{ gap: space.xs }}>
        {todos.length === 0 ? (
          <EmptyState label="Nothing yet — add the first one below." />
        ) : (
          todos.map((todo) => (
            <CheckboxRow
              key={todo.id}
              label={todo.label}
              checked={todo.done}
              onToggle={() => toggle(todo.id)}
            />
          ))
        )}
      </Card>

      <View style={{ gap: space.md }}>
        <TextField
          label="New reminder"
          value={draft}
          onChangeText={setDraft}
          placeholder="Book the restaurant"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Button label="Add" onPress={submit} disabled={!draft.trim()} full />
      </View>
    </Screen>
  );
}
