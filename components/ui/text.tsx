import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typeScale, type TextRole } from '@/constants/tokens';
import { useTheme } from '@/components/providers/theme-provider';

// RN's TextProps already carries an ARIA `role`; intersecting it with our own
// union would collapse to the single shared member ('button'), so drop theirs.
export type TextProps = Omit<RNTextProps, 'role'> & {
  /** Named role from the type scale. Screens pick a role, never a raw size. */
  role?: TextRole;
  color?: string;
  /** Use tabular figures — for streaks, battery %, XP, countdowns. */
  tabular?: boolean;
  center?: boolean;
};

/**
 * The only text primitive in the app. Roles map 1:1 to the type scale in the
 * design system; `tracking` is stored as an em ratio so it is multiplied by the
 * font size here.
 */
export function Text({
  role = 'body',
  color,
  tabular,
  center,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const spec = typeScale[role];

  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: spec.fontFamily,
          fontSize: spec.fontSize,
          color: color ?? theme.color.textPrimary,
        },
        spec.tracking != null && { letterSpacing: spec.fontSize * spec.tracking },
        spec.lineHeight != null && { lineHeight: spec.lineHeight },
        spec.uppercase && { textTransform: 'uppercase' },
        tabular && { fontVariant: ['tabular-nums'] },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {spec.uppercase && typeof children === 'string' ? children.toUpperCase() : children}
    </RNText>
  );
}
