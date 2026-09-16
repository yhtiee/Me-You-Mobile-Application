import { supabase } from '@/lib/supabase';

/**
 * The two people in a couple, by name.
 *
 * Lives here rather than in `lib/play.ts`, where it started as `fetchPlayPeople`.
 * Play was simply the first feature that needed a partner's name; it was never
 * a Play concern. Five screens outside Play — the paired confirmation, You, the
 * "say something" sheet, Notifications and Unpair — instead read the name from
 * the mock `CoupleProvider`, whose partner is a hardcoded "Sarah". Everyone saw
 * a stranger's name where their partner's should have been.
 */

export type CouplePeople = {
  you: { id: string; name: string };
  /** Null while unpaired, or after the other half leaves. */
  partner: { id: string; name: string } | null;
};

function toMessage(error: { message: string }, what: string): Error {
  return new Error(`We couldn’t ${what}. ${error.message}`);
}

/**
 * The placeholder `profiles.display_name` falls back to when a signup carries no
 * name and no email. As *your* name it reads fine. As your partner's it would
 * put "Say something to You" on screen, so for the partner it counts as no name.
 */
const UNNAMED = 'You';

export async function fetchCouplePeople(coupleId: string, userId: string): Promise<CouplePeople> {
  const { data, error } = await supabase
    .from('couple_members')
    .select('user_id, profiles(display_name)')
    .eq('couple_id', coupleId)
    .is('left_at', null);

  if (error) throw toMessage(error, 'load your hub');

  const rows = (data ?? []) as {
    user_id: string;
    // PostgREST types an embedded to-one relation as an array in some versions;
    // `lib/home.ts` normalises the same way for the same reason.
    profiles: { display_name: string | null } | { display_name: string | null }[] | null;
  }[];

  const displayName = (row: (typeof rows)[number] | undefined): string | null => {
    if (!row) return null;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return profile?.display_name?.trim() || null;
  };

  const mine = rows.find((row) => row.user_id === userId);
  const theirs = rows.find((row) => row.user_id !== userId);

  const partnerName = displayName(theirs);

  // The fallbacks differ on purpose. Your own missing name reads fine as "You" —
  // it is what the copy would have said anyway. Theirs cannot be "They", which
  // would put "They goes first" on the coin, so it falls back to "Your partner".
  return {
    you: { id: userId, name: displayName(mine) ?? UNNAMED },
    partner: theirs
      ? {
          id: theirs.user_id,
          name: partnerName && partnerName !== UNNAMED ? partnerName : 'Your partner',
        }
      : null,
  };
}
