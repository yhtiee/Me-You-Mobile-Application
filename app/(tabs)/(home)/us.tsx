import { Screen } from '@/components/ui/screen';
import { UsSegment } from '@/components/home/us-segment';
import { space } from '@/constants/tokens';

/** Was the "Us" segment of Home; now a pushed screen behind its quick action. */
export default function Us() {
  return (
    <Screen gap={space.md}>
      <UsSegment />
    </Screen>
  );
}
