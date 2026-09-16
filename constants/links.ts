/**
 * The website's public pages — the same URLs listed on the store listings and
 * in the AdMob consent message.
 *
 * The origin comes from `EXPO_PUBLIC_WEBSITE_URL` (no trailing slash), set in
 * `.env` locally and in every EAS environment. Referenced statically so Metro
 * inlines it. Unset, the links are `null` and Settings hides their rows rather
 * than opening a page that doesn't exist.
 */
const origin = process.env.EXPO_PUBLIC_WEBSITE_URL?.replace(/\/+$/, '') || null;

export const legalLinks = {
  privacy: origin ? `${origin}/privacy/` : null,
  terms: origin ? `${origin}/terms/` : null,
  support: origin ? `${origin}/support/` : null,
} as const;
