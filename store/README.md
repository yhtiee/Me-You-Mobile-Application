# Store assets

Everything the Play Console asks for, and the scripts that produce it. All of it
is generated from the app's own artwork and design tokens, so the store, the
launcher and the app cannot drift apart.

## What's here

| File | Where it goes | Play's rules |
|---|---|---|
| `play/icon-512.png` | Play Console → Store listing → App icon | 512×512, 32-bit PNG, sRGB, under 1MB, full square, no rounded corners or drop shadow of its own |
| `play/feature-graphic.png` | Play Console → Store listing → Feature graphic | 1024×500, PNG or JPEG, under 15MB |
| `wordmark-white.png` | Source for the graphics above | Generated; not uploaded anywhere |

Play rounds the icon's corners at 30% and adds its own shadow, so the uploaded
asset must be a plain square. It also crops and overlays the feature graphic on
some surfaces — and drops a play button in the middle when a promo video is
attached — so nothing that has to be read sits near the edges or dead centre.

## Regenerating

Both scripts need dependencies that aren't part of the app:

```bash
npm i -D sharp puppeteer-core
node store/make-icons.mjs            # app icon, adaptive icon layers, store icon, wordmark
node store/make-feature-graphic.mjs  # renders store/feature-graphic.html in Chrome
```

`make-icons.mjs` derives everything from `assets/images/android-icon-monochrome.png`,
the wordmark as a silhouette. Change that file and every icon follows. The
colours are the app's own: the couple gradient from `constants/tokens.ts`
(`#D63C58` → `#6E5AC8`) with the wordmark in white.

Edit `feature-graphic.html` to change the graphic's wording — it's a plain web
page, set in the app's fonts from `@expo-google-fonts`.

## Still needed for the listing

- **Phone screenshots** — at least 2, up to 8. 16:9 or 9:16, each side between
  320px and 3,840px. These have to come off a real device or an emulator running
  a development build; nothing here can generate them.
- **Tablet screenshots** — only if you list tablet support. `app.json` sets
  `ios.supportsTablet: false`, and there are no Android tablet screens, so skip.
- **Short description** (80 characters) and **full description** (4,000).
