import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

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

  /**
   * The size actually being rendered, which is not always the role's size.
   *
   * Both derived values below — tracking and line height — are ratios of the
   * font size in the design system, but they used to be resolved against
   * `spec.fontSize` and then emitted *before* the caller's `style`. So a caller
   * overriding `fontSize` got the new size with the old size's leading: the
   * default `body` role carries `lineHeight: 21.7`, which meant
   * `<Text style={{ fontSize: 64 }}>🪙</Text>` laid a 64px glyph into a 21.7px
   * line box and clipped it top and bottom. Resolving against the flattened
   * style keeps the ratios true at whatever size wins.
   *
   * A caller passing an explicit `lineHeight` or `letterSpacing` still wins —
   * those are read here only so this does not fight them.
   */
  const flat = StyleSheet.flatten(style) ?? {};
  const size = typeof flat.fontSize === 'number' ? flat.fontSize : spec.fontSize;

  const letterSpacing =
    spec.tracking != null && flat.letterSpacing == null ? size * spec.tracking : undefined;

  const lineHeight =
    spec.lineHeight != null && flat.lineHeight == null
      ? (spec.lineHeight / spec.fontSize) * size
      : undefined;

  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: spec.fontFamily,
          fontSize: spec.fontSize,
          color: color ?? theme.color.textPrimary,
        },
        spec.uppercase && { textTransform: 'uppercase' },
        tabular && { fontVariant: ['tabular-nums'] },
        center && { textAlign: 'center' },
        style,
        // After `style`, because these are derived *from* it. Each is undefined
        // when the caller set it themselves, and an undefined value in a style
        // array leaves the earlier one standing.
        letterSpacing != null && { letterSpacing },
        lineHeight != null && { lineHeight },
      ]}
    >
      {spec.uppercase && typeof children === 'string' ? children.toUpperCase() : children}
    </RNText>
  );
}
