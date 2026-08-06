import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { icon } from '@/constants/tokens';

type IconProps = {
  size?: number;
  color: string;
};

/**
 * App icon set — outline, 24-unit grid, one stroke width throughout.
 *
 * These replace the emoji that used to stand in for icons. Emoji render from
 * whichever font the OS supplies, so they shift between iOS and Android, ignore
 * the colour tokens entirely, and cannot be sized against a grid — which is why
 * the set is drawn rather than typed.
 *
 * Keep additions outline-only at this hierarchy level; a filled glyph dropped
 * in beside these reads as a different family.
 */

/** QR/code motif — the hub you create and hand over. */
export function HubIcon({ size = icon.lg, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="2.2" stroke={color} strokeWidth={icon.stroke} />
      <Rect x="14" y="3" width="7" height="7" rx="2.2" stroke={color} strokeWidth={icon.stroke} />
      <Rect x="3" y="14" width="7" height="7" rx="2.2" stroke={color} strokeWidth={icon.stroke} />
      {/* The fourth corner reads as data rather than a frame — that asymmetry
          is what makes it a QR and not four boxes. */}
      <Path
        d="M14 14.5v2M14 20.8h2.2M18.6 14v3.4M21 21v-2.4M17.4 21H16"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Chain link — joining onto someone else's hub. */
export function JoinIcon({ size = icon.lg, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L12 5"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Password is visible — tapping hides it. */
export function EyeIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0Z"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={icon.stroke} />
    </Svg>
  );
}

/** Password is hidden — tapping reveals it. */
export function EyeOffIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The slash is what makes the two states tell apart at a glance — an
          eye with a subtly different lid does not. */}
      <Path
        d="m2 2 20 20"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Disclosure chevron, replacing the `›` character these rows used to print. */
export function ChevronIcon({ size = icon.sm, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 5 7 7-7 7"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
