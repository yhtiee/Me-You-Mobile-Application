import { PlayHub } from '@/components/play/play-hub';
import { Screen } from '@/components/ui/screen';
import { space } from '@/constants/tokens';

/** Was the "Play" segment of Home; now a pushed screen behind its quick action. */
export default function Play() {
  return (
    <Screen gap={space.lg}>
      <PlayHub />
    </Screen>
  );
}
