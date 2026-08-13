import { supabase } from '@/lib/supabase';
import { todayKey } from '@/lib/home';
import type { LoveLanguage, WikiEntry } from '@/types/domain';

/**
 * The Us screen's slice of the database: goals, bucket list, the partner wiki
 * and both people's love languages.
 *
 * Same shape as `lib/home.ts` — plain async functions that throw a written
 * `Error`, with the loading and error story owned by the hook above them.
 */

export type UsGoal = {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string | null;
  done: boolean;
};

export type UsBucketItem = {
  id: string;
  label: string;
  done: boolean;
};

export type UsWikiRow = {
  subjectUserId: string;
  category: WikiEntry['category'];
  label: string;
  value: string | null;
};

export type UsLoveLanguageRow = {
  userId: string;
  key: LoveLanguage['key'];
  value: number;
};

export type UsSnapshot = {
  coupleId: string;
  partner: { userId: string; name: string } | null;
  streak: number;
  /** How many of the two checked in today, 0-2. Feeds the health number. */
  checkedInToday: number;
  goals: UsGoal[];
  bucket: UsBucketItem[];
  wiki: UsWikiRow[];
  loveLanguages: UsLoveLanguageRow[];
};

function toMessage(error: { message: string }, what: string): Error {
  if (/network|fetch|timeout/i.test(error.message)) {
    return new Error('You’re offline. Check your connection and try again.');
  }
  return new Error(`Couldn’t ${what}. ${error.message}`);
}

type ProfileRow = { display_name: string | null };
type MemberRow = { user_id: string; profiles: ProfileRow | ProfileRow[] | null };

function nameOf(row: MemberRow): string | null {
  const { profiles } = row;
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  return profile?.display_name?.trim() || null;
}

/**
 * Everything the Us screen renders, in seven queries fired together.
 *
 * `love_languages` is fetched with no filter at all, which looks like a bug and
 * is not: the policy on that table is `shares_couple_with(user_id)`, so an
 * unfiltered select already returns exactly two people's rows — yours and your
 * partner's. Adding `.in('user_id', [...])` would mean waiting on the member
 * query first and turning one parallel batch into two sequential ones, to
 * re-state a restriction the database is already enforcing.
 */
export async function fetchUsSnapshot(coupleId: string, userId: string): Promise<UsSnapshot> {
  const [coupleRes, membersRes, checkinsRes, goalsRes, bucketRes, wikiRes, loveRes] =
    await Promise.all([
      supabase.from('couples').select('streak_count').eq('id', coupleId).maybeSingle(),
      supabase
        .from('couple_members')
        .select('user_id, profiles(display_name)')
        .eq('couple_id', coupleId)
        .is('left_at', null),
      supabase
        .from('check_ins')
        .select('user_id')
        .eq('couple_id', coupleId)
        .eq('entry_date', todayKey()),
      supabase
        .from('goals')
        .select('id, label, current, target, unit, done')
        .eq('couple_id', coupleId)
        .order('done', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('bucket_list_items')
        .select('id, label, done')
        .eq('couple_id', coupleId)
        .order('done', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('wiki_entries')
        .select('subject_user_id, category, label, value')
        .eq('couple_id', coupleId),
      supabase.from('love_languages').select('user_id, key, value'),
    ]);

  if (coupleRes.error) throw toMessage(coupleRes.error, 'load your hub');
  if (membersRes.error) throw toMessage(membersRes.error, 'load your hub');
  if (checkinsRes.error) throw toMessage(checkinsRes.error, 'load today’s check-ins');
  if (goalsRes.error) throw toMessage(goalsRes.error, 'load your goals');
  if (bucketRes.error) throw toMessage(bucketRes.error, 'load your bucket list');
  if (wikiRes.error) throw toMessage(wikiRes.error, 'load the wiki');
  if (loveRes.error) throw toMessage(loveRes.error, 'load love languages');

  const members = (membersRes.data ?? []) as MemberRow[];
  const partnerRow = members.find((m) => m.user_id !== userId);

  const checkinUsers = new Set(
    ((checkinsRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id)
  );

  return {
    coupleId,
    partner: partnerRow
      ? { userId: partnerRow.user_id, name: nameOf(partnerRow) ?? 'Your partner' }
      : null,
    streak: (coupleRes.data as { streak_count: number } | null)?.streak_count ?? 0,
    checkedInToday: checkinUsers.size,
    goals: ((goalsRes.data ?? []) as UsGoalRow[]).map((g) => ({
      id: g.id,
      label: g.label,
      // `numeric` arrives as a JSON number, but a string is what PostgREST sends
      // for values past IEEE-754 range. Coerced rather than trusted, because a
      // string here would silently break every progress bar on the screen.
      current: Number(g.current),
      target: Number(g.target),
      unit: g.unit,
      done: g.done,
    })),
    bucket: (bucketRes.data ?? []) as UsBucketItem[],
    wiki: ((wikiRes.data ?? []) as WikiRow[]).map((w) => ({
      subjectUserId: w.subject_user_id,
      category: w.category,
      label: w.label,
      value: w.value,
    })),
    loveLanguages: ((loveRes.data ?? []) as LoveRow[]).map((l) => ({
      userId: l.user_id,
      key: l.key,
      value: l.value,
    })),
  };
}

type UsGoalRow = {
  id: string;
  label: string;
  current: number | string;
  target: number | string;
  unit: string | null;
  done: boolean;
};

type WikiRow = {
  subject_user_id: string;
  category: WikiEntry['category'];
  label: string;
  value: string | null;
};

type LoveRow = { user_id: string; key: LoveLanguage['key']; value: number };

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export async function createGoal(input: {
  coupleId: string;
  userId: string;
  label: string;
  target: number;
  unit: string | null;
}): Promise<void> {
  const { error } = await supabase.from('goals').insert({
    couple_id: input.coupleId,
    created_by: input.userId,
    label: input.label,
    target: input.target,
    unit: input.unit,
  });

  if (error) throw toMessage(error, 'add that goal');
}

/**
 * Log one more of whatever the goal counts.
 *
 * Reaching the target completes the goal in the same statement — a bar that
 * sits full while the row still says "2/4 dates" is the kind of detail that
 * makes people stop trusting the number.
 *
 * Last write wins if both partners tap at once, which for a counter that only
 * moves up is a lost increment, not corruption. An atomic `current + 1` needs an
 * RPC; worth adding when the pair are genuinely using this at the same moment.
 */
export async function incrementGoal(goal: UsGoal): Promise<void> {
  const next = Math.min(goal.current + 1, goal.target);

  const { error } = await supabase
    .from('goals')
    .update({ current: next, done: next >= goal.target })
    .eq('id', goal.id);

  if (error) throw toMessage(error, 'update that goal');
}

export async function setGoalDone(goalId: string, done: boolean): Promise<void> {
  // `completed_at` is the `goals_sync_completion` trigger's job, not ours.
  const { error } = await supabase.from('goals').update({ done }).eq('id', goalId);
  if (error) throw toMessage(error, 'update that goal');
}

// ---------------------------------------------------------------------------
// Bucket list
// ---------------------------------------------------------------------------

export async function addBucketItem(input: {
  coupleId: string;
  userId: string;
  label: string;
}): Promise<void> {
  const { error } = await supabase.from('bucket_list_items').insert({
    couple_id: input.coupleId,
    created_by: input.userId,
    label: input.label,
  });

  if (error) throw toMessage(error, 'add that');
}

export async function setBucketItemDone(itemId: string, done: boolean): Promise<void> {
  // Unlike `goals`, this table has no completion trigger — `done_at` is ours.
  const { error } = await supabase
    .from('bucket_list_items')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', itemId);

  if (error) throw toMessage(error, 'update that');
}

// ---------------------------------------------------------------------------
// Wiki
// ---------------------------------------------------------------------------

/**
 * Fill or change one wiki slot.
 *
 * Upserts on `(couple_id, subject_user_id, label)` — the natural key the schema
 * added for exactly this, so the client never has to know whether a slot has a
 * row yet. An empty string is written as null, which is what "unfilled" means
 * to the `N of M` count.
 */
export async function saveWikiEntry(input: {
  coupleId: string;
  subjectUserId: string;
  authorUserId: string;
  category: WikiEntry['category'];
  label: string;
  value: string;
}): Promise<void> {
  const { error } = await supabase.from('wiki_entries').upsert(
    {
      couple_id: input.coupleId,
      subject_user_id: input.subjectUserId,
      author_user_id: input.authorUserId,
      category: input.category,
      label: input.label,
      value: input.value.trim() || null,
    },
    { onConflict: 'couple_id,subject_user_id,label' }
  );

  if (error) throw toMessage(error, 'save that');
}

// ---------------------------------------------------------------------------
// Love languages
// ---------------------------------------------------------------------------

/**
 * Write all five rows at once, normalised to total 100.
 *
 * The schema is explicit that it does not enforce the total — "a CHECK cannot
 * see sibling rows, and a trigger doing it would reject every intermediate
 * state while the user is still dragging" — and names the API layer as the
 * place that normalises. This is that place.
 *
 * The editor collects 0-5 importance ratings rather than percentages, so this
 * is also where a rating becomes a share. Rounding is distributed to the
 * largest remainder so the five values total exactly 100 and not 99.
 */
export function toShares(
  ratings: { key: LoveLanguage['key']; rating: number }[]
): { key: LoveLanguage['key']; value: number }[] {
  const total = ratings.reduce((sum, r) => sum + r.rating, 0);
  if (total === 0) return ratings.map((r) => ({ key: r.key, value: 0 }));

  const exact = ratings.map((r) => ({ key: r.key, share: (r.rating / total) * 100 }));
  const values = exact.map((e) => ({ key: e.key, value: Math.floor(e.share) }));

  // Hand the leftover points to the largest fractional parts first, so the five
  // values total exactly 100 rather than 98 — the editor shows these live, and
  // a column of percentages that does not add up is the first thing a user
  // notices and the last thing they forgive.
  let remainder = 100 - values.reduce((sum, v) => sum + v.value, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e.share - Math.floor(e.share) }))
    .sort((a, b) => b.frac - a.frac);

  for (const { i } of order) {
    if (remainder <= 0) break;
    values[i].value += 1;
    remainder -= 1;
  }

  return values;
}

export async function saveLoveLanguages(
  userId: string,
  ratings: { key: LoveLanguage['key']; rating: number }[]
): Promise<void> {
  const { error } = await supabase.from('love_languages').upsert(
    toShares(ratings).map((v) => ({ user_id: userId, key: v.key, value: v.value })),
    { onConflict: 'user_id,key' }
  );

  if (error) throw toMessage(error, 'save your love languages');
}
