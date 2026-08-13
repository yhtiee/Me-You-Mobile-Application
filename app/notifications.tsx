import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { space } from '@/constants/tokens';

/**
 * Where the header's bell lands.
 *
 * Deliberately empty: there is no notification source in the data layer yet, so
 * seeding this with invented nudges would put fake state in front of the user.
 * When the feed exists it reads through a hook like every other screen — this
 * file grows a list and nothing else moves.
 *
 * It sits in the root stack rather than inside a tab so the bell reaches it
 * from all four tabs without four copies of the route.
 */
export default function Notifications() {
  const theme = useTheme();

  return (
    <Screen gap={space.md}>
      <Text role="body" color={theme.color.textSecondary}>
        Nudges, check-in reminders and anything your partner sends your way will
        show up here.
      </Text>

      <EmptyState label="You’re all caught up." />
    </Screen>
  );
}
