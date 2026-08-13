# Me&u — UI Layer Implementation Plan

> **Status: built.** All eleven phases are implemented. `tsc --noEmit` and `eslint` are clean,
> and `expo export` bundles for both iOS and Android. See §9 for what changed during the build
> and §10 for how to run it.

**Scope:** bootstrap the complete UI layer (screens, navigation, design system, interactions) against mock data. No backend, no auth provider, no billing SDK, no AdMob SDK — those seams are stubbed behind typed hooks so the API work drops in without touching screens.

**Sources reconciled:** `MeAndU_App_PRD.pdf` (v1.0), `Design Tokens.dc.html`, `MeAndU App.dc.html` (interactive mock), existing `meyou-mobile-app` Expo scaffold.

---

## 0 · Decisions already locked

| Decision | Choice | Consequence |
|---|---|---|
| Tab bar | `NativeTabs` from `expo-router/unstable-native-tabs` | Native iOS/M3 chrome, free liquid glass on iOS 26 |
| Theming | Light-only, dark-ready | Every colour via `useTheme()`; zero hex in screens |
| Data seam | Context + typed hooks over a mock store | Hook bodies swap to `fetch` later; screens untouched |

### Correction to the tab-bar trade-off

When I raised this I said NativeTabs couldn't hit the exact inactive colour or label weight. Checking the SDK 54 docs, that was wrong — `NativeTabs` accepts `iconColor={{ default, selected }}`, `labelStyle`, `backgroundColor` and `blurEffect`. So we get the token spec *and* the native chrome:

```tsx
<NativeTabs
  iconColor={{ default: '#C4BAC9', selected: '#F0546F' }}
  labelStyle={{ fontFamily: 'Manrope_700Bold', fontSize: 10, color: '#C4BAC9' }}
  tintColor="#F0546F"
  blurEffect="systemUltraThinMaterialLight"
  minimizeBehavior="onScrollDown"
>
```

No custom tab bar component is needed. This removes an item from the build.

---

## 1 · Environment facts that shape the plan

Verified against `package.json` and the SDK 54 docs (per `AGENTS.md`).

- **Expo SDK 54.0.35**, expo-router 6.0.24, React Native 0.81.5, React 19.1.0.
- **New Architecture is ON** (`newArchEnabled: true`) → CSS gradients via `experimental_backgroundImage` are available. **Do not add `expo-linear-gradient`.**
- **`typedRoutes` and `reactCompiler` are ON.** Typed routes means every `href` is checked — route files must exist before they're linked. React Compiler means no manual `useMemo`/`useCallback` unless profiling says otherwise.
- **SDK 54 NativeTabs syntax differs from SDK 55.** Icons/Labels are *standalone* imports, not `NativeTabs.Trigger.Icon`:
  ```tsx
  import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
  <NativeTabs.Trigger name="(home)"><Icon sf="house.fill" /><Label>Home</Label></NativeTabs.Trigger>
  ```
- **Android tab icons are a real gotcha.** SDK 54 has no `md` prop (that's SDK 55). Options are `drawable="ic_x"` (needs native resources → custom build) or `androidSrc={require(...)}` or `VectorIcon`. **Plan: `VectorIcon` with `@expo/vector-icons` (already installed) on Android, `sf` on iOS** — keeps us in Expo Go.
- **SDK 54 NativeTabs has no automatic content insets** (SDK 55 feature). Every screen's first child must be a `ScrollView` with `contentInsetAdjustmentBehavior="automatic"`.

### Dependencies to add

| Package | Why | Expo Go? |
|---|---|---|
| `@expo-google-fonts/plus-jakarta-sans` | Display face (weights 500/600/700/800) | Yes |
| `@expo-google-fonts/manrope` | UI/body face (400/500/600/700) | Yes |
| `react-native-svg` | Whose-Turn wheel segments, mood rings, XP arc | Yes |
| `react-native-qrcode-svg` | Couple-ID QR on Create Hub (PRD §3) | Yes (needs svg) |

Fonts load via `useFonts` at runtime (Expo Go friendly). Swap to the `expo-font` config plugin before a production build so glyphs are bundled, not fetched.

**Explicitly NOT adding:** `expo-linear-gradient` (use `experimental_backgroundImage`), `expo-blur` (NativeTabs `blurEffect` covers the tab bar), `expo-symbols` (use `expo-image` with `source="sf:name"`).

### Scaffold files to delete

The Expo starter template ships demo code that will otherwise rot in the tree:

```
app/(tabs)/explore.tsx          components/hello-wave.tsx
app/modal.tsx                   components/parallax-scroll-view.tsx
components/themed-text.tsx      components/external-link.tsx
components/themed-view.tsx      components/ui/collapsible.tsx
components/haptic-tab.tsx       components/ui/icon-symbol.tsx
hooks/use-theme-color.ts        components/ui/icon-symbol.ios.tsx
```

`constants/theme.ts` gets fully rewritten. `hooks/use-color-scheme.ts` stays — it's the hook dark mode will hang off later.

`app.json` needs: real `name`/`slug` ("Me&u" / "meyou"), `scheme: "meyou"`, brand splash/adaptive-icon colours (`#FBF8FA` light), and `android.softwareKeyboardLayoutMode: "resize"` for the code-entry and goal forms.

---

## 2 · PRD ↔ mock divergences (decisions I'm making, flag any you disagree with)

The PRD and the redesign mock disagree in four places. I'm following the **mock**, since it's the later artefact and the tokens doc is written against it.

1. **Tools is not a tab.** PRD Module 2 calls for a "Tools Tab"; the mock nests all five tools under **Home → Play**. Tabs are Home / Coach / Calendar / You. Following the mock.
2. **"Us" is not a tab.** PRD Module 3 calls for an "Us" Tab; the mock makes Us a **Home segment** (Today / Us / Play). Following the mock. Wiki and Shared Goals are pushed screens off the Us segment.
3. **Level is hardcoded.** Mock pins level 10 / "Soulmates". PRD §5 defines five tiers. I'll model all five tiers in `mocks/` so the level-up dialog and badge have real data to render, defaulting to level 10 to match the mock.
4. **Currency.** PRD shows "Save ₦50,000 / $100 together"; the mock omits it. I'll keep the dual-currency string in the goals mock — it signals the NGN/USD requirement to whoever builds the API.

Two PRD items have **no mock design** and will be built as reasonable first-pass UI, marked with a `// DESIGN GAP` comment for your review:
- **Relationship Health Bar** (P2) — placed on the Us segment as a token-compliant progress bar.
- **Weakness Growth Tracker** (P2) — placed inside the Games tool as a habit list with weekly self-rating.

---

## 3 · Architecture

```
app/                                   # routes ONLY — no components, no utils
  _layout.tsx                          # fonts, ThemeProvider, CoupleProvider, root Stack
  +not-found.tsx
  (onboarding)/
    _layout.tsx                        # Stack, headerShown: false
    index.tsx                          # 3-page swipeable pager (PRD §3)
    auth.tsx                           # Google / Apple / Email
    pair.tsx                           # Create Hub vs Join Partner
    create-hub.tsx                     # 6-char code + QR
    join-partner.tsx                   # code entry
    paired.tsx                         # success -> Level 1 "Crushes"
  (tabs)/
    _layout.tsx                        # <NativeTabs>
    (home)/
      _layout.tsx  index.tsx           # Today | Us | Play segmented
      wiki.tsx  add-goal.tsx  bucket-list.tsx
      tools/coin.tsx  wheel.tsx  date.tsx  picker.tsx  games.tsx
    (coach)/  _layout.tsx  index.tsx   # AI chat, 3/day free counter
    (calendar)/ _layout.tsx  index.tsx  add-event.tsx
    (you)/    _layout.tsx  index.tsx  settings.tsx
  # presented over everything, declared in root Stack:
  checkin.tsx        # formSheet — mood + battery
  need.tsx           # formSheet — "what do you need?"
  handoff.tsx        # formSheet — open WhatsApp/iMessage/Instagram
  streak.tsx         # modal — streak rules + level progress
  match.tsx          # modal — both swiped right
  limit.tsx          # modal — 3 coach questions used
  unpair.tsx         # modal — destructive confirm
  paywall.tsx        # modal — $1/mo

components/
  ui/                # button, card, chip, segmented-control, progress-bar,
                     # streak-badge, ad-slot, empty-state, dialog, sheet-header
  duo/               # duo-state-card, mood-ring, mood-picker, battery-slider
  tools/             # coin, wheel, swipe-deck
  providers/         # theme-provider, couple-provider
constants/tokens.ts  # the whole of tokens.json, typed
hooks/               # use-theme, use-checkin, use-streak, use-wiki, use-goals,
                     # use-premium, use-coach, use-tools
mocks/               # couple.ts, wiki.ts, goals.ts, calendar.ts, coach.ts, levels.ts
types/domain.ts      # Mood, Need, WikiEntry, Goal, CalendarEvent, Level, CoachMessage
```

**The seam.** Screens never touch `mocks/` and never hold cross-screen state. They call hooks:

```tsx
// today segment
const { mood, battery, need, save } = useCheckin();
const { count, level, nextMilestone } = useStreak();
const { isPremium } = usePremium();
```

Today those hooks read `CoupleProvider`'s in-memory state seeded from `mocks/`. At API time each hook body becomes a query/mutation and **no screen file changes**. That is the whole point of the choice you made — I'll enforce it with a lint-style rule in review: no `import ... from '@/mocks'` inside `app/`.

---

## 4 · Design system (Phase 1 detail)

`constants/tokens.ts` is a direct, typed transcription of the `tokens.json` block — colour (brand/person/mood/light/dark/gradient), font scale, space, radius, shadow, motion, layout. Nothing invented; the tokens doc says "never invent new hues at implementation time" and I'll hold to that.

Token → RN mapping notes:
- **Shadows** use the CSS `boxShadow` string prop (`'0 4px 18px rgba(34,26,43,0.06)'`), never legacy `shadowOffset`/`elevation`.
- **`bg.wash`** is `experimental_backgroundImage: 'linear-gradient(180deg,#FCEFF3,#FBF8FA 34%)'` on a full-bleed view behind each screen.
- **Radii** always pair with `{ borderCurve: 'continuous' }` except pills.
- **Typography** ships as a `Text` wrapper exposing the 10 named roles (`display`, `title1-3`, `cardTitle`, `button`, `bodyStrong`, `body`, `caption`, `overline`) — screens pick a role, never a raw size. `tracking` maps to `letterSpacing` (note: tokens express it as an em ratio, so `-0.03` → `size * -0.03`).
- **Counters** (streak, battery %, XP, countdown) get `fontVariant: ['tabular-nums']`.
- **Hit targets** built to 48 (the Android minimum) everywhere, per the tokens doc.

Primitives to build, straight from tokens §5: `Button` (primary/secondary/premium/neutral/destructive/chip), `Card`, `DuoStateCard`, `SegmentedControl`, `ProgressBar`, `StreakBadge`, `AdSlot`, `EmptyState`, `Dialog`, `MoodRing`.

The **`DuoStateCard`** is the app's signature component and gets built first: two equal cards, 12px gap, overline = person name in their colour, 58px mood ring (5px border in mood colour) with battery % centred, label + need line beneath. Yours tappable, theirs read-only. Person→colour mapping is fixed (you = rose, partner = iris) and never swaps.

---

## 5 · Build phases

Each phase is independently reviewable in the simulator.

| # | Phase | Contents | Est. |
|---|---|---|---|
| 0 | **Foundation** | Delete starter files, add 4 deps, load fonts, rewrite `app.json`, write `constants/tokens.ts` + `ThemeProvider` + `Text` roles | 0.5d |
| 1 | **Primitives** | All 10 UI primitives + `DuoStateCard`, on a scratch gallery route for visual QA | 1d |
| 2 | **Navigation skeleton** | Every route file above, stubbed; NativeTabs configured; all sheets/modals present and dismissible | 0.5d |
| 3 | **Data seam** | `types/domain.ts`, `mocks/*`, `CoupleProvider`, all 8 hooks | 0.5d |
| 4 | **Onboarding + pairing** | 3-page pager, auth, pair choice, create-hub (code + QR), join-partner (6-char entry), paired success | 1d |
| 5 | **Home · Today** | Couple banner + duration counter, streak badge, duo state cards, check-in box w/ deep links, personal to-dos, ad slot | 1.5d |
| 6 | **Home · Us** | Love languages breakdown, shared goals + add-goal, bucket list, wiki (+ offline-cached tick), health bar | 1.5d |
| 7 | **Home · Play + tools** | Play grid; coin flip, whose-turn wheel, date setter (+ indecision resolver, raincheck), movie/meal swipe picker, games/growth tracker | 2d |
| 8 | **Coach · Calendar · You** | Coach chat + 3/day counter, calendar w/ countdowns, You profile + level + settings, paywall | 1.5d |
| 9 | **Sheets & dialogs** | checkin, need, handoff, streak, match, limit, unpair — wired to the hooks | 1d |
| 10 | **Motion & polish** | Motion tokens applied, haptics, a11y pass, Android parity pass, empty/loading states | 1d |

**~12 days** of focused work. Phases 0-3 are the load-bearing ones; if they're right, 4-10 are mostly assembly.

---

## 6 · The tricky bits, and how they get built

**Coin flip** (`motion.coin`, 1150ms, 5-6 rotations, settles on the result face). Reanimated `withTiming` on `rotateY` to `spins*360 + (heads ? 0 : 180)` with the token's cubic-bezier. Two absolutely-positioned faces with `backfaceVisibility: 'hidden'`, the back face pre-rotated 180°. Result is decided *before* the animation starts (as the mock does) — the animation reveals a known outcome rather than producing it. Light-impact haptic on settle, both platforms (tokens §6 allows haptic on coin/wheel settle on Android).

**Whose-turn wheel** (`motion.wheel`, 1400ms, 4-5 rotations). `react-native-svg` `Path` arcs for the segments, one shared rotation transform, pointer fixed at top. Same decide-then-animate approach: `spins*360 + (idx*seg + seg/2)`. Customisable option list, so segment count is dynamic — arc maths must not assume four.

**Movie/meal picker.** Gesture-handler `Pan` + Reanimated for the swipe deck; like/pass thresholds, rotation on drag. "Alerts only when both swipe right" is a server concern — the UI fires the `match` modal on a mock coincidence flag, exactly as the mock stubs it.

**Check-in deep links.** `expo-linking` (installed) with `canOpenURL` probing for `whatsapp://`, `sms:`, `instagram://`, falling back to a share sheet. Must degrade gracefully — the simulator has none of these installed.

**60fps requirement (PRD §6).** All three animations above run on the UI thread via Reanimated worklets. No `setState` inside animation frames. Worth profiling the wheel on a low-end Android before calling phase 7 done.

**Ad slots.** UI-only dashed placeholders per tokens §5 — no AdMob SDK. Placement rules from the tokens doc are enforced structurally: never inside a duo card or sheet, and Android gets at most one interstitial slot per session, never mid-tool.

**Paywall.** Pure UI. `upgradeNow()` flips a local `isPremium` flag so you can demo both states; no StoreKit/Play Billing. Restore-purchases row is present but inert.

---

## 7 · What this plan deliberately excludes

- Firebase/Supabase, real auth, real pairing sync, sockets
- StoreKit 2 / Play Billing, AdMob SDK
- The LLM call behind the coach (chat UI is real, responses come from `mocks/coach.ts`)
- Push notifications / FCM channels
- E2E encryption for notes and wishlists
- Offline caching via Hive/AsyncStorage (the wiki renders its "cached offline" tick, but nothing is actually persisted)
- Dark mode rendering (tokens are wired, the switch is off)
- Automated tests — flag if you want component tests in scope; I'd otherwise add them alongside the API layer

---

## 9 · What changed during the build

Four things differed from the plan. Three were plan errors, one was a rule I broke and fixed.

1. **`VectorIcon` is not a tab-trigger child on SDK 54.** The plan said Android icons would use
   `VectorIcon` directly under `NativeTabs.Trigger`. Reading `expo-router`'s own type
   definitions, it is passed as `androidSrc` on `<Icon>`:
   `<Icon sf={{...}} androidSrc={<VectorIcon family={MaterialIcons} name="home" />} />`.
   The original form typechecks but renders `null`, so Android would have shipped with no tab
   icons at all. Fixed in [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx).

2. **`Text` needed `Omit<RNTextProps, 'role'>`.** React Native's `TextProps` already carries an
   ARIA `role`; intersecting it with our own `TextRole` union collapsed the prop to their single
   shared member, `'button'`. Every `<Text role="title1">` in the app was a type error until the
   built-in prop was dropped.

3. **The theme colour type had to be widened.** `color: typeof palette.light` pinned the field to
   the *light* hex literals, so the dark palette could never satisfy it — which would have blocked
   the one-line dark-mode switch the whole approach is built around. Now a mapped type over the
   token keys.

4. **Four tool screens imported `@/mocks` directly**, violating the seam rule stated in §3. Added
   [hooks/use-tools.ts](hooks/use-tools.ts) and routed the wheel, date, picker and games screens
   through it. `app/` now has zero imports from `mocks/` — worth keeping as a review check, since
   this is exactly the rule that makes the API swap cheap.

Two smaller calls, both flagged inline in the code:

- ~~**Back affordance** uses the native header button rather than the spec's
  chevron-in-a-36px-circle.~~ **Resolved.** The native bar is gone; every stack now renders
  [components/ui/screen-header.tsx](components/ui/screen-header.tsx), which restores the spec's
  36px circle. Turning the native header off costs none of what it bought — swipe-back and the
  Android hardware/gesture back are properties of the stack, not the bar.
- **Battery input** is a 6-stop button row, not a drag slider. Avoids a dependency and stays usable
  with assistive tech and large font scales. In [app/checkin.tsx](app/checkin.tsx).

The four open questions in §10 were resolved with the conservative defaults: providers plus an
inline email form on auth; couple banner as an inert drop target (no `expo-image-picker`, so the
dependency count stayed at four); native paging `ScrollView` for onboarding; and the mock's level-10
/ 47-day demo values kept as-is.

## 10 · Running it

The project folder name contains `&`, which breaks `npx`'s cmd shim on Windows — `npx expo start`
fails with `Cannot find module 'C:\Users\HP\Desktop\expo\bin\cli'`. Call the CLI through node
instead:

```
node node_modules/expo/bin/cli start
```

Then scan with Expo Go. Everything runs there — no custom build is needed, which is why Android
icons go through `androidSrc` rather than native drawables. Renaming the folder to remove the `&`
would also fix `npx`, if you'd rather do that.

## 11 · Open questions for you

Resolved with defaults during the build (see §9) — reopen any of these if the default is wrong:

1. **Auth screen scope** — built all three providers as inert buttons plus a revealable email form.
2. **Couple banner photo** — inert drop-target state, no `expo-image-picker`. Say the word and it
   becomes a real picker; it's a one-component change in `components/home/couple-banner.tsx`.
3. **Onboarding pager** — native paging `ScrollView`.
4. **Level default** — kept at level 10 / 47-day streak, matching the mock.

Still genuinely open:

5. **Component tests.** Currently none. Worth adding alongside the API layer, or sooner?
6. **The two DESIGN GAP items** — Relationship Health Bar and Weakness Growth Tracker — are first-
   pass UI with no mock to check against. Both are marked `// DESIGN GAP` in the source. The health
   score formula in `hooks/use-relationship.ts` is my invention from the PRD wording and should
   probably be a product decision rather than mine.
