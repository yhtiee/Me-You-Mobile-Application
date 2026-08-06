import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { EyeIcon, EyeOffIcon } from '@/components/ui/icons';

import { Text } from '@/components/ui/text';
import { useScreenScroll } from '@/components/ui/screen';
import { useTheme } from '@/components/providers/theme-provider';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { fontFamily, layout, radius, space } from '@/constants/tokens';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  /** Validation message. Replaces `hint` while present and reddens the border. */
  error?: string | null;
  /**
   * Masks the value and adds a show/hide toggle. Use this instead of
   * `secureTextEntry` on password fields — it owns the masking itself.
   */
  revealable?: boolean;
};

/** Gap left between the field and the top of the keyboard when scrolling it up. */
const BREATHING_ROOM = space.xxl;

/** radius.sm 8 inputs, overline field label. */
export function TextField({ label, hint, error, revealable, style, onFocus, ...rest }: Props) {
  const [revealed, setRevealed] = useState(false);
  const theme = useTheme();
  const scrollBy = useScreenScroll();
  const keyboard = useKeyboardInset();
  const inputRef = useRef<TextInput>(null);

  /*
   * Read through a ref, not the closure. At the moment a field takes focus the
   * keyboard is still shut, so `keyboard` is 0 in that render — the height only
   * lands a beat later, and the callback below has to see the fresh value
   * rather than the one captured when it was scheduled.
   */
  const keyboardRef = useRef(0);
  useEffect(() => {
    keyboardRef.current = keyboard;
  }, [keyboard]);

  /**
   * Lift the field above the keyboard when it takes focus.
   *
   * Only Android needs this — iOS gets it from the scroll view's
   * `automaticallyAdjustKeyboardInsets`, and `useKeyboardInset` reports 0 there
   * so the maths below folds away on its own.
   *
   * The delay is unavoidable: on focus the keyboard has not finished animating
   * in, so its height is not known yet and measuring immediately would compare
   * against stale metrics.
   */
  const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => {
    onFocus?.(e);

    setTimeout(() => {
      const keyboardHeight = keyboardRef.current;
      if (keyboardHeight <= 0) return;

      inputRef.current?.measureInWindow((_x, y, _w, height) => {
        const keyboardTop = Dimensions.get('window').height - keyboardHeight;
        const overlap = y + height + BREATHING_ROOM - keyboardTop;
        if (overlap > 0) scrollBy(overlap);
      });
    }, 250);
  };

  return (
    <View style={{ gap: space.sm - 2 }}>
      {label ? (
        <Text role="overline" color={theme.color.textTertiary}>
          {label}
        </Text>
      ) : null}
      <View>
        <TextInput
          ref={inputRef}
          placeholderTextColor={theme.color.textTertiary}
          {...rest}
          // Owned here, not by the caller: `revealable` is the whole feature,
          // and letting a screen also pass `secureTextEntry` would give two
          // sources of truth for one boolean.
          secureTextEntry={revealable ? !revealed : rest.secureTextEntry}
          onFocus={handleFocus}
          style={[
            {
              minHeight: layout.minTarget,
              borderRadius: radius.sm,
              borderCurve: 'continuous',
              // 1.5 rather than 1 when invalid: the width change is what carries
              // the state where the colour shift alone does not read.
              borderWidth: error ? 1.5 : 1,
              borderColor: error ? theme.color.danger : theme.color.border,
              backgroundColor: theme.color.surface,
              paddingHorizontal: space.lg - 2,
              // Keeps the text off the toggle. Without it a long password runs
              // under the eye and the last characters are unreadable — exactly
              // when the user is trying to read them.
              paddingRight: revealable ? layout.minTarget + space.sm : space.lg - 2,
              paddingVertical: space.md,
              fontFamily: fontFamily.body.medium,
              fontSize: 15,
              color: theme.color.textPrimary,
            },
            style,
          ]}
        />

        {revealable ? (
          <Pressable
            accessibilityRole="button"
            // Announces the action, not the state — a screen reader user needs
            // to know what the tap will do.
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((value) => !value)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: layout.minTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {revealed ? (
              <EyeOffIcon color={theme.color.textSecondary} />
            ) : (
              <EyeIcon color={theme.color.textSecondary} />
            )}
          </Pressable>
        ) : null}
      </View>
      {/*
       * The error replaces the hint rather than stacking under it. Both at once
       * makes the field grow and shrink as validity flips, which shoves the rest
       * of the form up and down under the user's thumb.
       */}
      {error ? (
        <Text role="caption" color={theme.color.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text role="caption" color={theme.color.textSecondary}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
