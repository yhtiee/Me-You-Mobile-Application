import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { useAsyncData } from '@/hooks/use-async-data';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import {
  addMedia,
  decodeAsset,
  fetchGallery,
  removeMedia,
  updateCaption,
  MAX_UPLOAD_BYTES,
  type MediaItem,
} from '@/lib/gallery';

const GALLERY_TABLES = ['couple_media'] as const;

const EMPTY: MediaItem[] = [];

export type MediaMonth = {
  /** `2026-08`, used as the key and to sort. */
  key: string;
  /** `August 2026`. */
  label: string;
  items: MediaItem[];
};

/**
 * Groups by the month the moment happened in, not the month it was uploaded.
 *
 * A gallery for "history purposes" that files a photo from last summer under
 * today is not a history of anything. `taken_at` comes from the picker's own
 * asset metadata; the column falls back to `created_at` when a source has none.
 */
function groupByMonth(items: MediaItem[]): MediaMonth[] {
  const months = new Map<string, MediaMonth>();

  for (const item of items) {
    const date = new Date(item.takenAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let month = months.get(key);
    if (!month) {
      month = {
        key,
        label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        items: [],
      };
      months.set(key, month);
    }
    month.items.push(item);
  }

  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function useGallery() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!coupleId) throw new Error('You’re not in a hub yet.');
    return fetchGallery(coupleId);
  }, [coupleId]);

  const { data, error, loading, refetch, setData } = useAsyncData(
    coupleId ? load : null,
    GALLERY_TABLES
  );

  const [uploading, setUploading] = useState(false);

  /**
   * Pick one or more photos/videos and upload them.
   *
   * `base64` is requested for images only — the picker does not produce it for
   * video, and asking would silently return an asset we cannot read. Videos go
   * through the same decode path via their own base64 read below, which is why
   * the size check happens on the decoded bytes rather than on `fileSize`:
   * `fileSize` is missing on some Android providers, and a limit that is
   * sometimes absent is not a limit.
   */
  const addFromLibrary = useCallback(async () => {
    if (!coupleId || !userId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Me&u needs access to your photos to add memories.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
      base64: true,
      exif: true,
    });

    if (picked.canceled) return;

    setUploading(true);
    let added = 0;
    let skipped = 0;

    try {
      for (const asset of picked.assets) {
        const kind: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';

        if (!asset.base64) {
          skipped += 1;
          continue;
        }

        const bytes = decodeAsset(asset.base64);
        if (bytes.byteLength > MAX_UPLOAD_BYTES) {
          skipped += 1;
          continue;
        }

        await addMedia({
          coupleId,
          userId,
          media: {
            bytes,
            kind,
            mimeType: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
            // EXIF first, then the asset's own timestamp, then now.
            takenAt: readTakenAt(asset),
            width: asset.width ?? null,
            height: asset.height ?? null,
            durationMs: asset.duration ?? null,
          },
        });
        added += 1;
      }

      refetch();

      if (added > 0 && skipped > 0) {
        toast.show(`Added ${added}. ${skipped} skipped — over 5 MB.`, 'info');
      } else if (skipped > 0) {
        toast.error(
          skipped === 1
            ? 'That one’s over 5 MB. Try a shorter clip.'
            : `${skipped} were over 5 MB and were skipped.`
        );
      } else if (added > 0) {
        toast.success(added === 1 ? 'Added to your gallery.' : `Added ${added} memories.`);
      }
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t add that.');
      refetch();
    } finally {
      setUploading(false);
    }
  }, [coupleId, userId, refetch, toast]);

  const remove = useCallback(
    (item: MediaItem) => {
      if (!data) return;
      const previous = data;
      setData(data.filter((m) => m.id !== item.id));

      void removeMedia(item).catch((thrown: unknown) => {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t delete that.');
      });
    },
    [data, setData, toast]
  );

  const setCaption = useCallback(
    (item: MediaItem, caption: string) => {
      if (!data) return;
      const previous = data;
      setData(data.map((m) => (m.id === item.id ? { ...m, caption: caption.trim() || null } : m)));

      void updateCaption(item.id, caption).catch((thrown: unknown) => {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that caption.');
      });
    },
    [data, setData, toast]
  );

  const items = data ?? EMPTY;

  return {
    items,
    months: groupByMonth(items),
    loading,
    error,
    refetch,
    addFromLibrary,
    uploading,
    remove,
    setCaption,
  };
}

function readTakenAt(asset: ImagePicker.ImagePickerAsset): string | null {
  const exifDate = asset.exif?.DateTimeOriginal;
  if (typeof exifDate === 'string') {
    // EXIF is `2026:08:13 14:22:01`; only the date half uses colons as
    // separators, and `Date` will not parse it until they are dashes.
    const iso = exifDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  // Left null rather than defaulted to now: the column falls back to
  // `created_at` on read, and a photo dated "today" because we could not read
  // its metadata is worse than one dated by when it was added.
  return null;
}
