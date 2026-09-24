/**
 * Regenerates the app and Play Store icons from the monochrome wordmark.
 *
 *   npm i -D sharp && node store/make-icons.mjs
 *
 * Writes:
 *   store/play/icon-512.png             the Play listing icon
 *   assets/images/icon.png              the app icon (iOS, and Expo's default)
 *   assets/images/android-icon-*.png    the adaptive icon's two layers
 *
 * All four are the same artwork: the couple gradient (`gradients.duo` in
 * constants/tokens.ts) with the wordmark in white. The source of truth for the
 * shape is `android-icon-monochrome.png`, which is the wordmark as a silhouette;
 * everything else is derived from it, so the set can never drift apart.
 *
 * Play's rules the sizes come from: 512x512, 32-bit PNG, sRGB, under 1MB, a
 * full square with no rounded corners or drop shadow of its own — Play rounds
 * at 30% and adds the shadow itself. Android masks the outer ~25% of an
 * adaptive icon, so the foreground wordmark sits inside the middle 60%.
 */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const APP = 'C:/Users/User/Desktop/MeYou/Me-You-Mobile-Application/';
const A = APP + 'assets/images/';
const STORE = APP + 'store/play/';
await mkdir(STORE, { recursive: true });

const GRAD = (size) => Buffer.from(
  `<svg width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="#D63C58"/><stop offset="1" stop-color="#6E5AC8"/></linearGradient></defs>` +
  `<rect width="${size}" height="${size}" fill="url(#g)"/></svg>`
);

// Wordmark bounds, from the monochrome master.
const { data, info } = await sharp(A + 'android-icon-monochrome.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * info.channels + 3] > 16) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };

/** The wordmark, painted one colour, at `width` px. */
async function mark(width, color) {
  const h = Math.round((box.height / box.width) * width);
  const alpha = await sharp(A + 'android-icon-monochrome.png')
    .ensureAlpha().extract(box).resize(width, h).extractChannel('alpha').raw().toBuffer();
  return sharp({ create: { width, height: h, channels: 3, background: color } })
    .joinChannel(alpha, { raw: { width, height: h, channels: 1 } }).png().toBuffer();
}
const WHITE = { r: 255, g: 255, b: 255 };

// 1. Play listing icon: 512, full square, no rounding, no shadow, opaque, sRGB.
await sharp(GRAD(512))
  .composite([{ input: await mark(Math.round(512 * 0.72), WHITE), gravity: 'center' }])
  .ensureAlpha().toColorspace('srgb').png().toFile(STORE + 'icon-512.png');

// 2. App icon (iOS + the app's own icon), same art at 1024.
await sharp(GRAD(1024))
  .composite([{ input: await mark(Math.round(1024 * 0.72), WHITE), gravity: 'center' }])
  .flatten().toColorspace('srgb').png().toFile(A + 'icon.png');

// 3. Adaptive icon layers. Android masks the outer ~25%, so the background is
//    the full gradient and the wordmark sits inside the 66% safe zone.
await sharp(GRAD(1024)).png().toFile(A + 'android-icon-background.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await mark(Math.round(1024 * 0.6), WHITE), gravity: 'center' }])
  .png().toFile(A + 'android-icon-foreground.png');

// 4. The wordmark on its own, in white and tightly cropped — used by the
//    feature graphic, and by any store asset that needs the logotype.
await sharp(await mark(1200, WHITE)).png().toFile(APP + 'store/wordmark-white.png');

const m = await sharp(STORE + 'icon-512.png').metadata();
const bytes = (await sharp(STORE + 'icon-512.png').toBuffer()).length;
console.log(`store icon: ${m.width}x${m.height} ${m.space} channels=${m.channels} ${(bytes / 1024).toFixed(0)}KB`);
