import { randomUUID } from 'expo-crypto';

import { supabase } from '@/lib/supabase';

/**
 * The couple's gallery — shared photos and videos, kept for the history.
 *
 * Objects live at `couples/<couple_id>/<uuid>`, which is what the storage
 * policies in 0011 authorise against. The client must build that path from the
 * couple id the session gave it and never from anything a user typed.
 */

const BUCKET = process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET ?? 'me&u';

/** Matches `couple_media_size_cap` and the bucket's `file_size_limit`. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type MediaKind = 'image' | 'video';

export type MediaItem = {
  id: string;
  kind: MediaKind;
  url: string;
  storagePath: string;
  caption: string | null;
  /** When the moment happened — the asset's own date, not the upload's. */
  takenAt: string;
  uploadedBy: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

function toMessage(error: { message: string }, what: string): Error {
  if (/network|fetch|timeout/i.test(error.message)) {
    return new Error('You’re offline. Check your connection and try again.');
  }
  if (/bucket not found/i.test(error.message)) {
    return new Error(
      `The "${BUCKET}" storage bucket doesn’t exist yet. Run migrations 0010 and 0011.`
    );
  }
  if (/exceeded the maximum allowed size|payload too large/i.test(error.message)) {
    return new Error('That file is over 5 MB. Try a shorter clip or a smaller photo.');
  }
  return new Error(`Couldn’t ${what}. ${error.message}`);
}

type MediaRow = {
  id: string;
  kind: MediaKind;
  storage_path: string;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  uploaded_by: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
};

/**
 * Everything in the gallery, newest moment first.
 *
 * Public URLs are built locally rather than stored — one string operation per
 * row against a round trip, and if the bucket is ever made private this is the
 * single function that has to start signing instead.
 */
export async function fetchGallery(coupleId: string): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from('couple_media')
    .select('id, kind, storage_path, caption, taken_at, created_at, uploaded_by, duration_ms, width, height')
    .eq('couple_id', coupleId)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw toMessage(error, 'load your gallery');

  return ((data ?? []) as MediaRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    storagePath: row.storage_path,
    url: supabase.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
    caption: row.caption,
    takenAt: row.taken_at ?? row.created_at,
    uploadedBy: row.uploaded_by,
    durationMs: row.duration_ms,
    width: row.width,
    height: row.height,
  }));
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < ALPHABET.length; i += 1) LOOKUP[ALPHABET.charCodeAt(i)] = i;

/** Same decoder as `lib/profile.ts`; see the note there on why it is hand-rolled. */
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

export type NewMedia = {
  bytes: Uint8Array;
  kind: MediaKind;
  mimeType: string;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

/** Turns a picker asset's base64 into the bytes the upload wants. */
export function decodeAsset(base64: string): Uint8Array {
  return base64ToBytes(base64);
}

/**
 * Put one file in the bucket and record it.
 *
 * The object goes up first. A row pointing at an object that failed to upload
 * is a permanent broken tile; an object with no row is invisible waste that a
 * later sweep can find. Failing in that order makes the worse outcome the
 * impossible one.
 */
export async function addMedia(input: {
  coupleId: string;
  userId: string;
  media: NewMedia;
  caption?: string;
}): Promise<void> {
  const { media } = input;

  if (media.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('That file is over 5 MB. Try a shorter clip or a smaller photo.');
  }

  /*
   * Random, not derived from the filename: two phones picking `IMG_0001.jpg`
   * must not collide, and in a public bucket the unguessability of this path is
   * the only thing keeping the object private.
   *
   * `expo-crypto`, not `globalThis.crypto.randomUUID()` — Hermes has no `crypto`
   * global at all, so that threw `cannot read property randomUUID of undefined`
   * on the first upload. `Math.random()` would have run, which is exactly why
   * it is the wrong fix: it is not a CSPRNG, and this path is a security
   * boundary.
   */
  const path = `couples/${input.coupleId}/${randomUUID()}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, media.bytes, { contentType: media.mimeType, upsert: false });

  if (uploadError) throw toMessage(uploadError, 'upload that');

  const { error } = await supabase.from('couple_media').insert({
    couple_id: input.coupleId,
    uploaded_by: input.userId,
    storage_path: path,
    kind: media.kind,
    mime_type: media.mimeType,
    size_bytes: media.bytes.byteLength,
    width: media.width,
    height: media.height,
    duration_ms: media.durationMs,
    taken_at: media.takenAt,
    caption: input.caption?.trim() || null,
  });

  if (error) {
    // Don't strand the object we just uploaded if the row would not take.
    await supabase.storage.from(BUCKET).remove([path]);
    throw toMessage(error, 'save that');
  }
}

export async function updateCaption(id: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from('couple_media')
    .update({ caption: caption.trim() || null })
    .eq('id', id);

  if (error) throw toMessage(error, 'save that caption');
}

/** Row first this time — an orphaned object is better than an orphaned tile. */
export async function removeMedia(item: MediaItem): Promise<void> {
  const { error } = await supabase.from('couple_media').delete().eq('id', item.id);
  if (error) throw toMessage(error, 'delete that');

  await supabase.storage.from(BUCKET).remove([item.storagePath]);
}
