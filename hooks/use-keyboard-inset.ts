import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height the on-screen keyboard is covering, on Android only.
 *
 * `app.json` asks for `softwareKeyboardLayoutMode: 'resize'`, but that maps to
 * `adjustResize`, which Android 15 ignores for apps drawing edge-to-edge — and
 * `edgeToEdgeEnabled` is on. The window therefore keeps its full height, the
 * keyboard simply covers the bottom of it, and a scroll view whose content
 * already fit has nothing to scroll. Adding this to the bottom padding is what
 * makes the covered fields reachable again.
 *
 * iOS is not handled here and returns 0: `automaticallyAdjustKeyboardInsets` on
 * the scroll view does the same job natively, and doing both would double up.
 */
export function useKeyboardInset(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Android only emits the `Did` pair; `WillShow`/`WillHide` are iOS-only.
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
