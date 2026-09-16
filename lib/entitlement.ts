import { supabase } from '@/lib/supabase';

/**
 * Whether this couple currently has premium, from the one place it is defined.
 *
 * `current_couple_is_premium()` (0026) applies the expiry rule
 * `is_premium and (premium_until is null or premium_until > now())`. Reading the
 * raw `is_premium` column instead — as Home used to — treats a lapsed
 * subscription as active: no ads on Home, while Coach, which asks the server,
 * enforces the free limit. Same person, two answers.
 *
 * Fails *closed to free*. If the check cannot be made, the caller is treated as
 * a free user and sees ads. The alternative — hiding ads whenever the network
 * blips — would quietly stop monetising the free tier during exactly the
 * outages nobody is watching for.
 */
export async function fetchIsPremium(): Promise<boolean> {
  const { data, error } = await supabase.rpc('current_couple_is_premium');

  if (error) {
    console.warn('Could not read premium status:', error.message);
    return false;
  }

  return data === true;
}
