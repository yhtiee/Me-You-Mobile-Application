/**
 * Field validators.
 *
 * A validator returns an error string or `null`. That shape is the whole
 * contract — `useForm` composes them and nothing else needs to know how a rule
 * is implemented.
 *
 * Messages are written for the person reading them, not the developer:
 * "Enter a valid email" rather than "invalid format". They are surfaced under
 * the field, so they say what to do rather than what went wrong.
 */

export type Validator<T> = (value: T) => string | null;

/**
 * A rule that may also read surrounding context — the other form values.
 *
 * `Validator<T>` is the one-argument case and stays assignable here, because
 * TypeScript lets a function that ignores a parameter satisfy a signature that
 * supplies one. That is what allows `compose(required(), matches('password'))`
 * to mix the two without either needing to know about the other.
 */
export type Rule<T, C = unknown> = (value: T, context: C) => string | null;

/** Runs rules in order and stops at the first failure — one message per field. */
export function compose<T, C = unknown>(...rules: Rule<T, C>[]): Rule<T, C> {
  return (value, context) => {
    for (const rule of rules) {
      const error = rule(value, context);
      if (error) return error;
    }
    return null;
  };
}

export function required(message = 'This one’s needed'): Validator<string> {
  return (value) => (value.trim().length > 0 ? null : message);
}

/**
 * Deliberately permissive: something@something.something.
 *
 * Strict RFC 5322 matching rejects addresses that genuinely deliver, and the
 * only authority on whether an address works is whether the confirmation email
 * arrives. This catches typos, not edge cases.
 */
export function email(message = 'Enter a valid email address'): Validator<string> {
  return (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? null : message);
}

export function minLength(length: number, message?: string): Validator<string> {
  return (value) =>
    value.length >= length ? null : message ?? `Use at least ${length} characters`;
}

export function exactLength(length: number, message?: string): Validator<string> {
  return (value) =>
    value.trim().length === length ? null : message ?? `That should be ${length} characters`;
}

/**
 * Supabase's own floor is 6. Requiring 8 here is a product choice, and it has to
 * stay at or above the server's minimum — a client rule looser than the server's
 * just moves the rejection to after the network round trip.
 */
export const PASSWORD_MIN_LENGTH = 8;

export function password(): Rule<string> {
  return compose(
    required('Choose a password'),
    minLength(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`)
  );
}

/**
 * A person's name.
 *
 * Only checks that something is there. No character class, no minimum beyond
 * one, no "letters only" — names contain apostrophes, hyphens, spaces, accents,
 * and scripts with no notion of a capital letter, and every rule stricter than
 * this one exists to reject somebody's real name.
 */
export function personName(message: string): Rule<string> {
  return required(message);
}

/**
 * Cross-field equality — the "confirm password" rule.
 *
 * Takes the whole form as its second argument, which is why `useForm` passes
 * it. Deliberately does not also re-check the password's own rules: if the
 * password is too short, that belongs under the password field, and repeating
 * it here would show the same complaint twice.
 */
export function matches<V extends Record<string, string>>(
  field: keyof V,
  message = 'Those don’t match'
): Rule<string, V> {
  return (value, values) => {
    // Stay quiet until there is something to compare against, so the message
    // does not appear before the user has typed a single character.
    if (value.length === 0) return null;
    return value === values[field] ? null : message;
  };
}

/** Six characters, A–Z and 2–9. Matches `generate_invite_code()` in 0002. */
export function coupleCode(): Rule<string> {
  return compose(
    required('Enter their code'),
    exactLength(6, 'Codes are six characters'),
    (value) =>
      /^[A-Z0-9]{6}$/.test(value.trim().toUpperCase()) ? null : 'Letters and numbers only'
  );
}
