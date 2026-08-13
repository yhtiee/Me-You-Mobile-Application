import { palette } from '@/constants/tokens';

/** Column names on `profiles`, used as the keys throughout so nothing maps. */
export type SocialKey = 'instagram' | 'tiktok' | 'x_handle' | 'snapchat';

/**
 * The networks the profile asks for.
 *
 * Accent colours come from the app's palette, not the platforms' own brand
 * colours. Instagram's gradient and Snapchat's yellow next to each other would
 * be four foreign identities on a screen whose whole job is to look like this
 * app — and the tokens doc is explicit that hues are never invented at
 * implementation time. The dots exist to tell the four rows apart, which any
 * four distinct colours do.
 */
export const SOCIAL_NETWORKS: {
  key: SocialKey;
  label: string;
  placeholder: string;
  color: string;
}[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'yourhandle', color: palette.brand.rose },
  { key: 'tiktok', label: 'TikTok', placeholder: 'yourhandle', color: palette.brand.iris },
  { key: 'x_handle', label: 'X', placeholder: 'yourhandle', color: palette.light.textPrimary },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'yourhandle', color: palette.brand.amber },
];

/**
 * What "complete" means, in one place.
 *
 * The home prompt counts these and the profile screen lists them, so a fourth
 * requirement is added here and nowhere else.
 */
export const PROFILE_REQUIREMENTS = ['avatar', 'phone', 'socials'] as const;

export type ProfileRequirement = (typeof PROFILE_REQUIREMENTS)[number];

export const REQUIREMENT_LABELS: Record<ProfileRequirement, string> = {
  avatar: 'A photo of you',
  phone: 'Your phone number',
  socials: 'One social handle',
};
