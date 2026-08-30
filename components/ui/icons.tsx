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

/**
 * Quick action — "Us": the shared half of the app (goals, wiki, bucket list).
 *
 * Two people rather than a heart: the You tab already owns the heart, and two
 * glyphs meaning different things is worse than one that means nothing.
 */
export function UsIcon({ size = icon.xl, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9.3" cy="8" r="3.3" stroke={color} strokeWidth={icon.stroke} />
      <Path
        d="M3.6 19.6a5.7 5.7 0 0 1 11.4 0"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
      />
      {/* The second figure is cropped by the first on purpose — overlapping is
          what makes it read as a pair rather than two separate people. */}
      <Path
        d="M16.4 6.2a2.9 2.9 0 0 1 .6 5.7M17.6 14.4a5 5 0 0 1 3 4.6"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Quick action — "Play": the tools that settle an argument. */
export function DiceIcon({ size = icon.xl, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3.4"
        y="3.4"
        width="17.2"
        height="17.2"
        rx="4.4"
        stroke={color}
        strokeWidth={icon.stroke}
      />
      {/* Pips are filled. At this radius an outlined dot is a smudge, and the
          three-pip diagonal is the only thing that says "dice" and not "box". */}
      <Circle cx="8.6" cy="8.6" r="1.35" fill={color} />
      <Circle cx="12" cy="12" r="1.35" fill={color} />
      <Circle cx="15.4" cy="15.4" r="1.35" fill={color} />
    </Svg>
  );
}

/** Quick action — "To-do": the private list only its owner sees. */
export function ChecklistIcon({ size = icon.xl, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.8 6h10.4M9.8 12h10.4M9.8 18h10.4"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
      />
      <Path
        d="m3 5.9 1.5 1.5L7.5 4.4M3 11.9l1.5 1.5L7.5 10.4"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The third row is left unticked — a list of three ticks is a receipt,
          not something you would tap. */}
      <Path d="M3.4 18h3.7" stroke={color} strokeWidth={icon.stroke} strokeLinecap="round" />
    </Svg>
  );
}

/** Add — the "+1" on a goal, the add button on a list. */
export function PlusIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5.5v13M5.5 12h13"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** A completed goal or a ticked bucket-list item. */
export function CheckIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m4.5 12.5 5 5 10-11"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Light mode is on — tapping goes dark. */
export function SunIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4.2" stroke={color} strokeWidth={icon.stroke} />
      <Path
        d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Dark mode is on — tapping goes light. */
export function MoonIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* A crescent cut from one arc, not a circle with a bite taken out of a
          second — the latter needs a mask and renders as a grey blob at 24px. */}
      <Path
        d="M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5a8.7 8.7 0 1 0 10.9 10.9Z"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Shared moments — the couple's gallery. */
export function GalleryIcon({ size = icon.xl, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3.2"
        y="4.6"
        width="17.6"
        height="14.8"
        rx="3.4"
        stroke={color}
        strokeWidth={icon.stroke}
      />
      {/* Horizon plus sun: the two marks that make a rectangle read as a photo
          rather than as a card or a window. */}
      <Circle cx="8.9" cy="9.6" r="1.6" stroke={color} strokeWidth={icon.stroke} />
      <Path
        d="m4 16.6 4.2-3.7a2.2 2.2 0 0 1 2.9 0l3 2.7M14.4 14.2l1.6-1.4a2.2 2.2 0 0 1 2.9 0l1.9 1.7"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Play affordance over a video thumbnail. */
export function PlayIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8.4 5.6 18.6 12 8.4 18.4Z" fill={color} stroke={color} strokeWidth={2.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** Remove — deletes the row it sits on. Never used for "close" in this app. */
export function CloseIcon({ size = icon.sm, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 6.5l11 11M17.5 6.5l-11 11"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Notifications. The clapper is a separate path so it reads at 24px. */
export function BellIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8.5a6 6 0 0 0-12 0c0 6.2-2.4 7.9-2.4 7.9h16.8S18 14.7 18 8.5Z"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.7 20a2 2 0 0 1-3.4 0"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Back chevron for the header. Mirrored `ChevronIcon`, drawn rather than rotated. */
export function BackIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m15 5-7 7 7 7"
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

/**
 * Send — an arrow, on the same 24-unit grid as everything else here.
 *
 * The composer used a `↑` character in a `Text` for this and a `+` for attach.
 * A typed glyph sits on a text baseline, not in the middle of its box, so both
 * rendered visibly high in their circular buttons — and where they landed
 * depended on the font the OS picked. Drawn icons centre because the viewBox
 * centres.
 */
export function SendIcon({ size = icon.md, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19V5"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m5.5 11.5 6.5-6.5 6.5 6.5"
        stroke={color}
        strokeWidth={icon.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Stop — the square that replaces send while a reply is streaming. */
export function StopIcon({ size = icon.sm, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="6" y="6" width="12" height="12" rx="2.5" fill={color} />
    </Svg>
  );
}
