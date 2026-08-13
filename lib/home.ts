import { supabase } from '@/lib/supabase';
import type { MoodKey, NeedKey } from '@/types/domain';

/**
 * The home screen's slice of the database.
 *
 * Everything here is a plain async function over `supabase` — no React, no
 * state. `hooks/use-home.ts` owns the loading/error/refetch story and the
 * screens read that. Keeping the two apart is what makes the queries testable
 * and the hook boring.
 *
 * Unlike `lib/pairing.ts` these throw instead of returning a result union. The
 * pairing screens surface four *different* failures inline in a form and have
 * to branch on them; home has exactly one failure UI (retry), so a thrown
 * `Error` carrying a written message is the cheaper shape.
 */

export type HomePerson = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

export type HomeCheckin = {
  mood: MoodKey;
  battery: number;
  /** Null until the Sad/Stressed follow-up is answered — nullable by design. */
  need: NeedKey | null;
  checkedOnPartner: boolean;
};

export type HomeSnapshot = {
  coupleId: string;
  togetherSince: string | null;
  streak: number;
  level: number;
  isPremium: boolean;
  you: HomePerson;
  /** Null while the other half of the couple has not joined (or has left). */
  partner: HomePerson | null;
  yourCheckin: HomeCheckin | null;
  partnerCheckin: HomeCheckin | null;
};

/**
 * The date key `check_ins` is filed under.
 *
 * UTC, because that is what the column's default is —
 * `(now() at time zone 'utc')::date`. Computing "today" locally here would put
 * the client and the server on different days for anyone far enough from
 * Greenwich, and since `entry_date` is half of the one-per-day unique
 * constraint, that means a second insert failing on a conflict the client
 * cannot see. The README's first open question is about fixing this properly
 * with a stored zone; until it is answered, both sides agree on UTC.
 */
export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

type ProfileRow = { display_name: string | null; avatar_url: string | null };

/**
 * PostgREST returns an embedded to-one relation as an object, but some versions
 * and some join shapes hand back a one-element array. Normalised rather than
 * asserted, because guessing wrong shows up as a blank name, not a crash.
 */
type MemberRow = { user_id: string; profiles: ProfileRow | ProfileRow[] | null };

type CheckinRow = {
  user_id: string;
  mood: MoodKey;
  battery: number;
  need: NeedKey | null;
  checked_on_partner: boolean;
};

type CoupleRow = {
  id: string;
  together_since: string | null;
  streak_count: number;
  level: number;
  is_premium: boolean;
};

/**
 * Turn a Supabase failure into something worth showing a person.
 *
 * The raw message is kept on the end rather than replaced with a generic
 * apology — same reasoning as `auth-provider`'s `toAuthResult`: a message we
 * did not anticipate still tells the user (and us) more than "went wrong".
 * The offline case is the one worth catching, because it is the common one and
 * the only one where "try again" is genuinely the right advice.
 */
function toMessage(error: { message: string }, what: string): Error {
  if (/network|fetch|timeout/i.test(error.message)) {
    return new Error('You’re offline. Check your connection and try again.');
  }
  return new Error(`Couldn’t ${what}. ${error.message}`);
}

function profileOf(row: MemberRow): ProfileRow | null {
  const { profiles } = row;
  if (!profiles) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}

function toCheckin(row: CheckinRow | undefined): HomeCheckin | null {
  if (!row) return null;
  return {
    mood: row.mood,
    battery: row.battery,
    need: row.need,
    checkedOnPartner: row.checked_on_partner,
  };
}

/**
 * Everything home renders, in three round trips fired together.
 *
 * Deliberately not one nested `select` with embedded resources. It would be a
 * single request, but the couple row, the two profiles and today's check-ins
 * have different filters (`left_at is null`, `entry_date = today`) that would
 * have to ride along as embedded-resource filters — a syntax that silently
 * returns *unfiltered* rows if the alias is wrong. Three flat queries in
 * parallel cost one round trip's latency between them and cannot fail that way.
 */
export async function fetchHomeSnapshot(coupleId: string, userId: string): Promise<HomeSnapshot> {
  const [coupleRes, membersRes, checkinsRes] = await Promise.all([
    supabase
      .from('couples')
      .select('id, together_since, streak_count, level, is_premium')
      .eq('id', coupleId)
      .maybeSingle(),
    supabase
      .from('couple_members')
      .select('user_id, profiles(display_name, avatar_url)')
      .eq('couple_id', coupleId)
      .is('left_at', null),
    supabase
      .from('check_ins')
      .select('user_id, mood, battery, need, checked_on_partner')
      .eq('couple_id', coupleId)
      .eq('entry_date', todayKey()),
  ]);

  if (coupleRes.error) throw toMessage(coupleRes.error, 'load your hub');
  if (membersRes.error) throw toMessage(membersRes.error, 'load your hub');
  if (checkinsRes.error) throw toMessage(checkinsRes.error, 'load today’s check-ins');

  const couple = coupleRes.data as CoupleRow | null;
  if (!couple) {
    // RLS would have returned zero rows rather than an error if this user is
    // not a member, so this is "your hub is gone", not "something broke".
    throw new Error('We couldn’t find your hub. Try logging in again.');
  }

  const members = (membersRes.data ?? []) as MemberRow[]; 
  const checkins = (checkinsRes.data ?? []) as CheckinRow[];

  const youRow = members.find((m) => m.user_id === userId);
  const partnerRow = members.find((m) => m.user_id !== userId);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   

  const you: HomePerson = {
    userId,
    // `display_name` is `not null default 'You'` server-side, so the fallback
    // here only covers a profile row that has not replicated yet.
    name: profileOf(youRow ?? { user_id: userId, profiles: null })?.display_name?.trim() || 'You',
    avatarUrl: youRow ? (profileOf(youRow)?.avatar_url ?? null) : null,
  };

  const partner: HomePerson | null = partnerRow
    ? {
        userId: partnerRow.user_id,
        name: profileOf(partnerRow)?.display_name?.trim() || 'Your partner',
        avatarUrl: profileOf(partnerRow)?.avatar_url ?? null,
      }
    : null;

  return {
    coupleId: couple.id,
    togetherSince: couple.together_since,
    streak: couple.streak_count,
    level: couple.level,
    isPremium: couple.is_premium,
    you,
    partner,
    yourCheckin: toCheckin(checkins.find((c) => c.user_id === userId)),
    partnerCheckin: toCheckin(
      partner ? checkins.find((c) => c.user_id === partner.userId) : undefined
    ),
  };
}

export type CoupleProgress = {
  streak: number;
  level: number;
  /** The streak only holds on days both of them showed up (PRD Module 1). */
  bothCheckedInToday: boolean;
};

/**
 * Streak and level, for the badge's dialog and the You screen.
 *
 * Separate from `fetchHomeSnapshot` rather than shared through a cache: these
 * two callers are dialogs opened on top of whatever screen you were on, and
 * making them re-run the whole home query to read two integers would be a
 * bigger cost than the extra round trip this is.
 */
export async function fetchCoupleProgress(coupleId: string): Promise<CoupleProgress> {
  const [coupleRes, checkinsRes] = await Promise.all([
    supabase.from('couples').select('streak_count, level').eq('id', coupleId).maybeSingle(),
    supabase
      .from('check_ins')
      .select('user_id')
      .eq('couple_id', coupleId)
      .eq('entry_date', todayKey()),
  ]);

  if (coupleRes.error) throw toMessage(coupleRes.error, 'load your streak');
  if (checkinsRes.error) throw toMessage(checkinsRes.error, 'load your streak');

  const couple = coupleRes.data as Pick<CoupleRow, 'streak_count' | 'level'> | null;
  const userIds = new Set(((checkinsRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id));

  return {
    streak: couple?.streak_count ?? 0,
    level: couple?.level ?? 1,
    bothCheckedInToday: userIds.size >= 2,
  };
}

/** Today's check-in for one person, for the sheet that edits it. */
export async function fetchMyCheckin(userId: string): Promise<HomeCheckin | null> {
  const { data, error } = await supabase
    .from('check_ins')
    .select('user_id, mood, battery, need, checked_on_partner')
    .eq('user_id', userId)
    .eq('entry_date', todayKey())
    .maybeSingle();

  if (error) throw toMessage(error, 'load your check-in');
  return toCheckin((data as CheckinRow | null) ?? undefined);
}

/**
 * Write today's check-in, creating it or amending it.
 *
 * `onConflict` names the `check_ins_one_per_day` constraint's columns, so
 * saving twice in a day updates rather than raising. Only the columns passed
 * here are written, which is what keeps `checked_on_partner` — set from a
 * different control on a different screen — from being reset on every save.
 *
 * The streak is not touched: `sync_couple_streak` advances it by trigger, and
 * only on the day's *second* check-in. Nothing the client does can bump it.
 */
export async function saveMyCheckin(input: {
  coupleId: string;
  userId: string;
  mood: MoodKey;
  battery: number;
  need?: NeedKey | null;
}): Promise<void> {
  const { error } = await supabase.from('check_ins').upsert(
    {
      couple_id: input.coupleId,
      user_id: input.userId,
      entry_date: todayKey(),
      mood: input.mood,
      battery: input.battery,
      ...(input.need === undefined ? {} : { need: input.need }),
    },
    { onConflict: 'user_id,entry_date' }
  );

  if (error) throw toMessage(error, 'save your check-in');
}

/** The Sad/Stressed follow-up. Amends the row today's check-in already created. */
export async function saveMyNeed(userId: string, need: NeedKey | null): Promise<void> {
  const { error } = await supabase
    .from('check_ins')
    .update({ need })
    .eq('user_id', userId)
    .eq('entry_date', todayKey());

  if (error) throw toMessage(error, 'save what you need');
}

/**
 * "Yes, I've checked up on <partner> today".
 *
 * An UPDATE, never an upsert: the flag lives on `check_ins`, whose `mood` and
 * `battery` are `not null`, so creating a row to hold it would mean inventing a
 * mood the user never gave — and that row would count toward the mutual-day
 * streak. The home screen only offers the control once a check-in exists.
 */
export async function setCheckedOnPartner(userId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from('check_ins')
    .update({ checked_on_partner: value })
    .eq('user_id', userId)
    .eq('entry_date', todayKey());

  if (error) throw toMessage(error, 'save that');
}
