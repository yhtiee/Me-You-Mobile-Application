import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/components/providers/theme-provider';
import { radius, shadow, space } from '@/constants/tokens';

type Props = ViewProps & {
  /** Optional 1px border in the owning person's soft colour. */
  accent?: string;
  padded?: boolean;
  elevated?: boolean;
};

/** surface.default · radius.lg 20 · padding 16 · shadow.2 */
export function Card({ accent, padded = true, elevated = true, style, children, ...rest }: Props) {
  const theme = useTheme();

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.color.surface,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          padding: padded ? space.lg : 0,
          boxShadow: elevated ? shadow.s2 : undefined,
          borderWidth: accent ? 1 : 0,
          borderColor: accent,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
