/**
 * The messaging apps the hand-off sheet offers, and what to say in them.
 *
 * The catalogue lives here rather than in the database on purpose — see the
 * note in `0017_daily_nudges.sql`. `key` is what gets written to
 * `daily_nudges.channel`, so it is a stable identifier and must not be renamed
 * to match a rebrand: changing `twitter` to `x` would orphan every row already
 * ticked. Change `label` instead.
 *
 * `nudge` is the whole point of the redesign. The sheet used to be three
 * unlabelled buttons, which answers "where" and leaves the actual hard part —
 * what do I even say — entirely to someone who already told us they were
 * stuck. Each line is a complete message they could send verbatim, written to
 * be low-effort rather than romantic: the bar this feature is clearing is "say
 * anything at all", and a suggestion that reads like a greetings card is one
 * more thing to fail to live up to.
 *
 * ## Icons
 *
 * Real brand marks from FontAwesome 6, which ships inside `@expo/vector-icons`
 * — already a dependency. Not emoji, which was the previous approach and had
 * the same three failures the app's own icon set was drawn to escape: emoji
 * render from whichever font the OS supplies so they differ between iOS and
 * Android, they ignore the colour tokens, and 💚 for WhatsApp is a green heart
 * that a user has to decode rather than recognise. Not bundled PNG logos
 * either — those are licensed assets, one per density per brand, for something
 * a font already draws as a vector.
 *
 * Each mark sits on its own brand fill in white, which is how these icons are
 * recognised in the wild. Two of the brands *are* a gradient rather than a
 * colour, so they get one via `experimental_backgroundImage` (New Arch, same
 * mechanism as every other gradient in the app). Snapchat is the exception
 * that proves the ink field is needed: white on #FFFC00 is 1.1:1, so its glyph
 * is near-black.
 */

export type NudgeChannel = {
  /** Stable id, written to `daily_nudges.channel`. Never rename. */
  key: string;
  label: string;
  /** FontAwesome 6 glyph name. */
  icon: string;
  /** Which FA6 face the glyph lives in. Brands are a separate font file. */
  iconStyle: 'brand' | 'solid';
  /** Tile fill. Ignored when `gradient` is set. */
  fill: string;
  /** For the brands whose identity is a gradient, not a single colour. */
  gradient?: string;
  /** Glyph colour on that fill. White everywhere the fill is dark enough. */
  ink: string;
  /** Deep link. Falls back to the share sheet when the app is not installed. */
  scheme: string;
  /** A message they could send as-is. */
  nudge: string;
};

export const NUDGE_CHANNELS: NudgeChannel[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'whatsapp',
    iconStyle: 'brand',
    fill: '#25D366',
    ink: '#FFFFFF',
    scheme: 'whatsapp://send',
    nudge: 'Thinking about you. How’s your day actually going?',
  },
  {
    key: 'sms',
    label: 'Messages',
    // Not a brand: "Messages" is two different apps on two platforms, so a
    // generic SMS mark is the honest icon rather than picking a side.
    icon: 'comment-sms',
    iconStyle: 'solid',
    fill: '#34C759',
    ink: '#FFFFFF',
    // `sms:` on both platforms — iOS and Android both register it, and the
    // per-OS branch this replaced resolved to the same string on both sides.
    scheme: 'sms:',
    nudge: 'No reason. Just wanted you to know I’m thinking of you.',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'instagram',
    iconStyle: 'brand',
    fill: '#DD2A7B',
    gradient: 'linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)',
    ink: '#FFFFFF',
    scheme: 'instagram://direct-inbox',
    nudge: 'Send them the thing that reminded you of them.',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: 'telegram',
    iconStyle: 'brand',
    fill: '#229ED9',
    ink: '#FFFFFF',
    scheme: 'tg://msg',
    nudge: 'Ask about the one thing they were dreading this week.',
  },
  {
    key: 'messenger',
    label: 'Messenger',
    icon: 'facebook-messenger',
    iconStyle: 'brand',
    fill: '#0084FF',
    gradient: 'linear-gradient(135deg,#00B2FF,#006AFF)',
    ink: '#FFFFFF',
    scheme: 'fb-messenger://',
    nudge: 'Tell them the small good thing that happened to you today.',
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    icon: 'snapchat',
    iconStyle: 'brand',
    fill: '#FFFC00',
    // White on this yellow is 1.1:1 — invisible. Near-black is 17:1.
    ink: '#1C1B00',
    scheme: 'snapchat://',
    nudge: 'Send whatever you’re looking at right now.',
  },
];
