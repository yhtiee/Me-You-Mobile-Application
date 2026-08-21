import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  /** The emoji itself. */
  children: string;
  /** Rendered size in points. The line box is derived from it by the platform. */
  size: number;
  /**
   * Announce the glyph with this label. Omitted by default, because an emoji
   * sitting next to a title it illustrates is decoration — a screen reader
   * reading "party popper, Whose turn" is worse than reading "Whose turn".
   */
  label?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * An emoji, at a size, without getting clipped.
 *
 * This deliberately does **not** build on `@/components/ui/text`. That component
 * resolves a role from the type scale, and the default role is `body`, which
 * carries `lineHeight: 21.7`. A caller writing `<Text style={{ fontSize: 64 }}>`
 * overrides the size but not the line height, so a 64px emoji was being laid
 * out into a 21.7px box and sliced off top and bottom. `Text` now scales its
 * line height with an overridden size, which fixes the clipping — but it would
 * then hand a 64px emoji a 99px line box, and that much leading throws the
 * glyph out of alignment with whatever it sits beside.
 *
 * Emoji want neither. The colour-emoji fonts on both platforms carry their own
 * ascent and descent, and the correct line box is the one the platform computes
 * from them — so the rule here is simply to set a size and set no line height
 * at all.
 *
 * `allowFontScaling` is off on purpose. These are pictures, not text: at the
 * largest accessibility text sizes a decorative glyph triples in height and
 * shoves the label it belongs to off the tile, and it carries no information
 * that scaling would make more readable.
 */
export function Glyph({ children, size, label, style }: Props) {
  const decorative = !label;

  return (
    <RNText
      accessible={!decorative}
      accessibilityLabel={label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      allowFontScaling={false}
      style={[{ fontSize: size, textAlign: 'center' }, style]}
    >
      {children}
    </RNText>
  );
}
