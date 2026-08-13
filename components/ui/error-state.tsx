import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { space } from '@/constants/tokens';

type Props = {
  /** Already written for a person — pass the message the API layer produced. */
  message: string;
  onRetry?: () => void;
  title?: string;
};

/**
 * What a screen shows when its data would not load.
 *
 * The counterpart to `EmptyState`: that one means "there is nothing here yet",
 * which is a normal state and gets the light dashed treatment. This means "we
 * could not find out", which is not normal, so it gets a real card and a real
 * button. Conflating the two trains users to ignore both.
 */
export function ErrorState({ message, onRetry, title = 'That didn’t load' }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <Text role="cardTitle">{title}</Text>
        <Text role="body" color={theme.color.textSecondary}>
          {message}
        </Text>
      </View>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}
