import { useCallback, useMemo, useRef, useState } from 'react';

import type { Validator } from '@/utils/validation';

type Values = Record<string, string>;

/**
 * A rule sees its own value and, optionally, the whole form.
 *
 * The second argument is what makes "confirm password" expressible. Plain
 * `Validator<string>` values still assign here — TypeScript lets a function
 * that ignores the extra parameter satisfy a signature that supplies it — so
 * every existing single-field rule keeps working untouched.
 */
export type FormRule<V extends Values> = (value: string, values: V) => string | null;

export type FormRules<V extends Values> = Partial<Record<keyof V, FormRule<V> | Validator<string>>>;

export type Form<V extends Values> = {
  values: V;
  errors: Partial<Record<keyof V, string>>;
  touched: Partial<Record<keyof V, boolean>>;
  submitting: boolean;
  /** True when every rule passes right now — drives the CTA's disabled state. */
  isValid: boolean;
  setValue: (field: keyof V, value: string) => void;
  /** Marks a field touched so its error may render. Call from `onBlur`. */
  blur: (field: keyof V) => void;
  /** Show a server-side failure against a specific field. */
  setError: (field: keyof V, message: string) => void;
  reset: () => void;
  submit: () => void;
};

/**
 * Small typed form state: values, errors, touched, submitting.
 *
 * The behaviour worth knowing is *when* an error appears. Rules run on every
 * keystroke so `isValid` is always current, but a message only renders once the
 * field is touched or submit has been attempted. Validating eagerly and showing
 * eagerly are different things — showing "Enter a valid email" while someone is
 * still typing the third character is just telling them off for not being
 * finished.
 *
 * Deliberately not a form library. There are three forms in this app and none
 * has arrays, nesting, or cross-field rules.
 */
export function useForm<V extends Values>({
  initial,
  rules,
  onSubmit,
}: {
  initial: V;
  rules: FormRules<V>;
  onSubmit: (values: V) => void | Promise<void>;
}): Form<V> {
  const [values, setValues] = useState<V>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof V, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Guards against a double-tap firing two sign-ups. State alone is too slow —
  // it does not update until the next render, and both taps read the old value.
  const inFlight = useRef(false);

  const ruleErrors = useMemo(() => {
    const next: Partial<Record<keyof V, string>> = {};
    for (const field of Object.keys(rules) as (keyof V)[]) {
      // Passing `values` re-runs every rule whenever any field changes, so a
      // confirm-password error clears the moment the password above it is
      // edited to match — not only when the confirm field itself is touched.
      const error = (rules[field] as FormRule<V> | undefined)?.(values[field] ?? '', values);
      if (error) next[field] = error;
    }
    return next;
  }, [rules, values]);

  const visibleErrors = useMemo(() => {
    const next: Partial<Record<keyof V, string>> = {};
    for (const field of Object.keys(values) as (keyof V)[]) {
      // A server error outranks a rule error: it is about this exact attempt.
      if (serverErrors[field]) next[field] = serverErrors[field];
      else if ((touched[field] || attempted) && ruleErrors[field]) next[field] = ruleErrors[field];
    }
    return next;
  }, [values, serverErrors, touched, attempted, ruleErrors]);

  const setValue = useCallback((field: keyof V, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Editing a field retracts the server's complaint about it — the value it
    // referred to no longer exists.
    setServerErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const blur = useCallback((field: keyof V) => {
    setTouched((current) => ({ ...current, [field]: true }));
  }, []);

  const setError = useCallback((field: keyof V, message: string) => {
    setServerErrors((current) => ({ ...current, [field]: message }));
  }, []);

  const reset = useCallback(() => {
    setValues(initial);
    setTouched({});
    setServerErrors({});
    setAttempted(false);
  }, [initial]);

  const submit = useCallback(() => {
    setAttempted(true);
    if (inFlight.current) return;
    if (Object.keys(ruleErrors).length > 0) return;

    inFlight.current = true;
    setSubmitting(true);

    Promise.resolve(onSubmit(values)).finally(() => {
      inFlight.current = false;
      setSubmitting(false);
    });
  }, [onSubmit, ruleErrors, values]);

  return {
    values,
    errors: visibleErrors,
    touched,
    submitting,
    isValid: Object.keys(ruleErrors).length === 0,
    setValue,
    blur,
    setError,
    reset,
    submit,
  };
}
