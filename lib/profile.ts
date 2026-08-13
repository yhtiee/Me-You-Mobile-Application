import { supabase } from '@/lib/supabase';
import { SOCIAL_NETWORKS, type SocialKey } from '@/constants/profile';

/**
 * The signed-in person's own profile row, plus their avatar in Storage.
 *
 * Everything here is scoped to one user by RLS (`id = auth.uid()` to write,
 * `shares_couple_with(id)` to read), so no call passes a user id as a filter
 * except where it builds a storage path — and there it must, because the first
 * path segment is the whole authorisation model for the bucket.
 */

/**
 * Must match the bucket in migration 0010. Overridable from the environment so
 * the name lives in one place — set `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET` in
 * `.env` and restart the dev server, since Expo only reads env vars at startup.
 *
 * The `&` is legal in a URL path segment (RFC 3986 sub-delim) and sits before
 * the `?`, so the public URL this builds is well-formed and nothing reads it as
 * a query separator. It is still the kind of character that trips up a proxy or
 * a log parser eventually — if avatars ever 404 while the object is plainly in
 * the bucket, that is the first thing to rule out.
 */
const AVATAR_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET ?? 'me&u';

export type Profile = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  socials: Record<SocialKey, string>;
};

function toMessage(error: { message: string }, what: string): Error {
  if (/network|fetch|timeout/i.test(error.message)) {
    return new Error('You’re offline. Check your connection and try again.');
  }
  return new Error(`Couldn’t ${what}. ${error.message}`);
}

const COLUMNS = 'id, display_name, first_name, last_name, avatar_url, phone, instagram, tiktok, x_handle, snapchat';

type ProfileRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
} & Record<SocialKey, string | null>;

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();

  if (error) throw toMessage(error, 'load your profile');
  if (!data) throw new Error('We couldn’t find your profile. Try logging in again.');

  const row = data as ProfileRow;

  return {
    id: row.id,
    displayName: row.display_name?.trim() || 'You',
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    socials: Object.fromEntries(
      SOCIAL_NETWORKS.map((network) => [network.key, row[network.key]?.trim() ?? ''])
    ) as Record<SocialKey, string>,
  };
}

export async function updateProfile(
  userId: string,
  patch: {
    displayName?: string;
    phone?: string;
    socials?: Partial<Record<SocialKey, string>>;
  }
): Promise<void> {
  const row: Record<string, string | null> = {};

  if (patch.displayName !== undefined) {
    // `display_name` is `not null` server-side, so an emptied field falls back
    // rather than being written as ''.
    row.display_name = patch.displayName.trim() || 'You';
  }
  if (patch.phone !== undefined) row.phone = patch.phone.trim() || null;

  for (const [key, value] of Object.entries(patch.socials ?? {})) {
    // Stored bare. People type, paste and copy handles with the @ attached, and
    // a column holding "@ana" and "ana" for the same thing cannot be used to
    // build a URL without cleaning it at every call site instead of this one.
    row[key] = value?.trim().replace(/^@+/, '') || null;
  }

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error) throw toMessage(error, 'save your profile');
}

/**
 * Base64 to bytes, by hand.
 *
 * `atob` is not reliably present in Hermes and the usual fix is another
 * dependency (`base64-arraybuffer`) for twenty lines of table lookup. Supabase
 * Storage takes a `Uint8Array` directly, so this is the whole gap.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < ALPHABET.length; i += 1) LOOKUP[ALPHABET.charCodeAt(i)] = i;

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));

  let out = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk =
      (LOOKUP[clean.charCodeAt(i)] << 18) |
      (LOOKUP[clean.charCodeAt(i + 1)] << 12) |
      (LOOKUP[clean.charCodeAt(i + 2)] << 6) |
      LOOKUP[clean.charCodeAt(i + 3)];

    bytes[out] = (chunk >> 16) & 0xff;
    out += 1;
    if (out < bytes.length) {
      bytes[out] = (chunk >> 8) & 0xff;
      out += 1;
    }
    if (out < bytes.length) {
      bytes[out] = chunk & 0xff;
      out += 1;
    }
  }

  return bytes;
}

/**
 * Upload a new avatar and point the profile row at it.
 *
 * One object per user at a fixed path, overwritten on every change — a
 * per-upload filename would leave every photo the user ever picked sitting in
 * the bucket, and nothing would ever delete them.
 *
 * The returned URL carries a `?v=` stamp because that path is stable: without
 * it `expo-image` would keep serving the previous photo from its disk cache
 * after a change, which reads as the upload having silently failed.
 */
export async function uploadAvatar(
  userId: string,
  file: { base64: string; mimeType: string }
): Promise<string> {
  const path = `${userId}/avatar`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, base64ToBytes(file.base64), {
      contentType: file.mimeType,
      upsert: true,
    });

  if (uploadError) {
    if (/bucket not found/i.test(uploadError.message)) {
      throw new Error(
        `The "${AVATAR_BUCKET}" storage bucket doesn’t exist yet. Run migration 0010, or set EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET to the bucket you made.`
      );
    }
    throw toMessage(uploadError, 'upload that photo');
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (error) throw toMessage(error, 'save that photo');

  return url;
}
