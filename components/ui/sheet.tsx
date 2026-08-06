import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { space } from '@/constants/tokens';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/**
 * Content shell for routes presented as `formSheet`.
 *
 * The grab handle and corner radius come from the native presentation
 * (`sheetGrabberVisible`, 30pt on iOS / 20dp on Android), so this only owns the
 * 22px content padding the spec calls for.
 */
export function SheetBody({ title, subtitle, children }: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.surface,
        paddingHorizontal: 22,
        paddingTop: 22,
        paddingBottom: space.xxxl,
        gap: space.lg,
      }}
    >
      <View style={{ gap: space.xs }}>
        <Text role="title3">{title}</Text>
        {subtitle ? (
          <Text role="body" color={theme.color.textSecondary}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
