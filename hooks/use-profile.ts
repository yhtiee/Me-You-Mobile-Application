import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { useAsyncData } from '@/hooks/use-async-data';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { fetchProfile, updateProfile, uploadAvatar, type Profile } from '@/lib/profile';
import {
  PROFILE_REQUIREMENTS,
  SOCIAL_NETWORKS,
  type ProfileRequirement,
  type SocialKey,
} from '@/constants/profile';

/** Your row, and your partner's edits to their own — both land in `profiles`. */
const PROFILE_TABLES = ['profiles'] as const;

export type Completeness = {
  met: ProfileRequirement[];
  missing: ProfileRequirement[];
  done: number;
  total: number;
  isComplete: boolean;
};

/**
 * What the home prompt counts and the profile screen fills in.
 *
 * The rule lives in `constants/profile` rather than here so the prompt, the You
 * screen's summary and the editor cannot disagree about what "complete" means —
 * three places showing three different fractions is the specific failure this
 * kind of nag screen is prone to.
 */
export function measure(profile: Profile | null): Completeness {
  const met: ProfileRequirement[] = [];

  if (profile) {
    if (profile.avatarUrl) met.push('avatar');
    if (profile.phone?.trim()) met.push('phone');
    if (SOCIAL_NETWORKS.some((network) => profile.socials[network.key]?.trim())) met.push('socials');
  }

  const missing = PROFILE_REQUIREMENTS.filter((requirement) => !met.includes(requirement));

  return {
    met,
    missing,
    done: met.length,
    total: PROFILE_REQUIREMENTS.length,
    // Never "complete" while the row is still loading — an unfinished profile
    // that briefly reports itself done makes the home prompt flash in and out.
    isComplete: profile !== null && missing.length === 0,
  };
}

export function useProfile() {
  const { user } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw new Error('Your session ended. Log in again to continue.');
    return fetchProfile(userId);
  }, [userId]);

  const { data, error, loading, refetch, setData } = useAsyncData(
    userId ? load : null,
    PROFILE_TABLES
  );

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = useCallback(
    async (patch: {
      displayName?: string;
      phone?: string;
      socials?: Partial<Record<SocialKey, string>>;
    }) => {
      if (!userId) return false;

      setSaving(true);
      try {
        await updateProfile(userId, patch);
        refetch();
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save your profile.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId, refetch, toast]
  );

  /**
   * Pick a photo and upload it.
   *
   * `base64: true` rather than reading the file afterwards: it saves a
   * dependency (`expo-file-system`) and a second pass over the same bytes, and
   * at `quality: 0.7` on a square crop the string stays small enough that the
   * memory cost of holding it is not worth a round trip to avoid.
   */
  const changeAvatar = useCallback(async () => {
    if (!userId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Me&u needs access to your photos to set a picture.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (picked.canceled) return;

    const asset = picked.assets[0];
    if (!asset?.base64) {
      toast.error('That photo couldn’t be read. Try another one.');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadAvatar(userId, {
        base64: asset.base64,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      // Patched locally as well as refetched: the upload is the slowest thing
      // on this screen and the photo should appear the instant it lands.
      if (data) setData({ ...data, avatarUrl: url });
      toast.success('Looking good.');
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t upload that photo.');
    } finally {
      setUploading(false);
    }
  }, [userId, data, setData, toast]);

  return {
    profile: data,
    completeness: measure(data),
    loading,
    error,
    refetch,
    save,
    saving,
    changeAvatar,
    uploading,
  };
}
