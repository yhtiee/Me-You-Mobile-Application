import { Screen } from '@/components/ui/screen';
import { TodaySegment } from '@/components/home/today-segment';
import { space } from '@/constants/tokens';

/**
 * Home is Today. The Today/Us/Play segmented control is gone — Us and Play are
 * pushed screens now, reached from the quick actions under the banner.
 */
export default function Home() {
  return (
    <Screen gap={space.md}>
      <TodaySegment />
    </Screen>
  );
}
