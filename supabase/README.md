# Me&u — database schema

Postgres schema for Supabase. Migrations are plain SQL and can be pasted
straight into the dashboard's SQL editor.

## Applying

Run in order. Each file is a single transaction's worth of work and assumes the
one before it has run.

| File | What it creates |
|------|-----------------|
| `0001_foundation.sql` | Extensions, enums, `updated_at` trigger, the three security helpers, `levels` table |
| `0002_identity.sql` | `profiles`, `couples`, `couple_members`, new-user trigger, pairing RPCs |
| `0003_checkins.sql` | `check_ins`, `love_languages`, streak trigger |
| `0004_shared.sql` | `goals`, `bucket_list_items`, `wiki_entries`, `calendar_events` |
| `0005_private.sql` | `todos`, `coach_messages`, `coach_usage` + quota RPC, `growth_habits` |
| `0006_tools.sql` | Picker + swipes + `picker_matches()`, trivia, date ideas, tool log |
| `0007_rls.sql` | Enables RLS on every table and defines all policies |
| `0008_seed.sql` | Levels, stock picker items, date ideas, trivia. Idempotent |
| `0009_realtime.sql` | Publishes the shared tables to `supabase_realtime`. Idempotent |
| `0010_profile.sql` | Profile phone + social columns, and the avatar storage bucket. Idempotent |

`0008` is safe to re-run. `0001`–`0007` are not — they use bare `create table`,
so re-running raises "already exists" rather than silently doing something
surprising. That is deliberate for a first cut.

### Why the order is strict

Postgres parses a **`language sql`** function body at `CREATE` time, so such a
function cannot reference a table that does not exist yet. **`language plpgsql`**
bodies are not parsed until first call, which is why the RPCs can reference each
other freely regardless of order.

That distinction dictates one placement: the security helpers
(`current_couple_id`, `is_couple_member`, `shares_couple_with`) are `language
sql` and read `couple_members`, so they live at the **bottom of 0002**, after
that table — not in 0001 with the other shared plumbing. Moving them "somewhere
tidier" reintroduces `relation "public.couple_members" does not exist`.

The only other `language sql` function is `picker_matches()` in 0006, which sits
below the two tables it reads.

### Starting over after a failed run

A partial run leaves half the objects behind, and re-running from the top then
fails on the ones that already exist. **On a development project with no real
data**, reset first:

```sql
-- DESTRUCTIVE. Drops every table, function, and policy in `public`.
-- Rows in auth.users survive; their profiles do not.
drop trigger if exists on_auth_user_created on auth.users;
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
```

Then run `0001` → `0008` in order.

**Apply `0007` before letting any client connect.** Between `0001` and `0007`
the tables exist with RLS off, which in Supabase means the anon key can read
everything.

## Shape

```
auth.users ──1:1── profiles ──┬── couple_members ──── couples
                              │                          │
                              │   (shared, both partners) │
                              ├── check_ins ──────────────┤
                              ├── goals, bucket_list_items│
                              ├── wiki_entries ───────────┤
                              ├── calendar_events ────────┤
                              │                           │
                              │   (private, owner only)   │
                              ├── todos                   │
                              ├── coach_messages ─────────┘
                              ├── growth_habits
                              └── picker_swipes
```

## Decisions worth arguing with

**Enums mirror `types/domain.ts` literally**, hyphens and all — `'quality-time'`,
`'first-date'`. The UI already ships those strings, so matching them means the
API layer never translates between wire and database values. The cost is that
renaming a mood is a migration.

**`couple_members` is a join table, not `user_a`/`user_b` columns on `couples`.**
Two columns would be smaller, but every policy would then be
`user_a = auth.uid() or user_b = auth.uid()`, and unpair/re-pair history has
nowhere to live. Members are marked with `left_at` rather than deleted so a
re-pair cannot silently inherit the previous couple's streak.

**Streak is denormalised onto `couples`** and maintained by trigger, rather than
counted from `check_ins` on read. The home screen asks for it on every render.

**The invite code is nulled on redemption**, not flagged. The create-hub screen
promises "it only works once", and removing the value is a stronger guarantee
than a boolean somebody forgets to check. Codes expire after 7 days and exclude
`I`, `O`, `0`, `1` — the characters people misread off someone else's screen.

**Pairing goes through `create_couple()` / `redeem_couple_code()`, never direct
inserts.** Redeeming means reading a couple you are by definition not a member
of, which RLS correctly forbids; putting that lookup in a `SECURITY DEFINER`
function with a narrow contract is what lets the policies stay strict. There is
no INSERT policy on `couples` or `couple_members` at all.

**The coach quota is enforced in `claim_coach_question()`**, server-side, in one
atomic statement. A client-side limit is not a limit, and this one guards the
only revenue path in the app. `coach_usage` is SELECT-only to clients.

**The coach transcript is shaped for a model, not a chat log.** The coach is a
conversational AI, so `coach_messages` is not just a record of what was said —
it is the thing replayed into the model's `messages` array on every turn, and
that changes four decisions:

- **Roles are wire roles** (`user` / `assistant` / `system`), not the UI's
  `you` / `coach`. One mapping at the edge beats translating a whole transcript
  per request, and a stray `coach` reaching the API is a 400.
- **`content` is `jsonb`, holding the API's content-block array verbatim** —
  not extracted text. Thinking is on by default on current models, and an
  assistant turn's thinking blocks must be replayed *unchanged* on the same
  model; flattening to a string silently drops them and breaks the next turn.
  `preview` holds flattened text for list rendering, and is never replayed.
- **Order is an explicit `seq`, not `created_at`.** Two rows in the same
  millisecond would order arbitrarily, and any reshuffle of the prefix
  invalidates the prompt cache from that point — turning a cheap cache read
  into a full re-process of the thread.
- **Usage is split four ways** (`input`, `output`, `cache_creation`,
  `cache_read`). Cache reads bill at roughly a tenth of fresh input, so one
  combined number both overstates the coach's cost and hides a broken cache.

`model` is pinned **per conversation** rather than globally: thinking blocks
may only be replayed to the model that produced them, and the prompt cache is
model-scoped, so switching mid-thread has to be deliberate. `prompt_version`
records which build of the system prompt a thread started under, since editing
it mid-thread shifts behaviour and breaks the cached prefix.

`stop_reason` gets its own column because a safety decline arrives as a normal
HTTP 200 with empty content — without it, a refused turn is indistinguishable
from one that produced nothing.

**`picker_matches()` is a function, not a view.** Swipes are owner-only —
"swipe separately, you'll only hear about the matches" — but computing a match
needs both sides. A `security_invoker` view would run under the caller's own
policy, see one row where it needs two, and return no matches ever. The definer
rights are contained by the function's shape: it only emits items where the
count is 2, and hard-scopes to the caller's couple.

**`couples.level` has no FK to `levels`.** That table holds five named tiers
(1, 5, 10, 20, 50); an FK would make level 7 unrepresentable. Resolve a title by
taking the highest tier at or below the number.

**Relationship health is not in the schema.** The formula in
`hooks/use-relationship.ts` is flagged in that file as invented from PRD wording
and awaiting your review. Encoding a guess as a generated column or view would
make it look decided. It stays computed in the app until you confirm it.

## Open questions

1. **Time zones.** `check_ins.entry_date` is UTC. A couple split across zones
   can disagree about which day it is, which matters because the streak is
   date-keyed — one of them could break a streak that, locally, they kept. The
   fix is storing a per-couple or per-user zone and computing the date in it.
   Not modelled, because the right answer depends on whether you treat the
   couple or the person as the clock.

2. **Growth habit history.** `growth_habits.rating` holds only the current
   value. The PRD calls it a *weekly* self-rating, which implies a
   `(habit_id, week_start, rating)` history table. Left out until the UI shows a
   trend — right now nothing renders one.

3. **`tool_events` may be dead weight.** Nothing reads it; the coin and wheel
   resolve on the device. It exists so "who's been the bigger person lately" is
   answerable later. Drop the table if that never ships.

4. **Premium is per couple, not per user** (`couples.is_premium`). If one
   partner subscribes, both get it. That seems right for a shared app but it is
   a pricing decision, not a technical one, and it changes what you can charge.

5. ~~**No storage bucket yet.**~~ **Settled for avatars, in `0010`.** The bucket
   is public-read, owner-write, keyed `<user_id>/avatar`: a profile photo is
   shown to the one person allowed to see it anyway, and signed URLs would mean
   re-signing on every render of the home banner and every list row. The bucket
   name is `me&u` and appears in exactly two places — the top of `0010` and
   `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET`, which `lib/profile.ts` falls back to
   the same literal for. Still open for the **couple banner photo**, which is a
   shared object and therefore a different policy: `<couple_id>/…` written by
   either member.

6. **Ads and receipts.** No tables for AdMob or store receipts. `is_premium` is
   currently something you would flip by hand; real billing needs a
   `subscriptions` table keyed on the store transaction.

7. **Who assigns `coach_messages.seq`?** Right now the writer does, and the
   unique constraint catches a collision after the fact. That is fine for one
   device; two devices posting to the same thread will see one insert rejected.
   A `before insert` trigger taking `max(seq) + 1` under the row lock would make
   it server-side — worth doing before multi-device.

8. **The model key does not belong in the app.** `EXPO_PUBLIC_` variables are
   compiled into the bundle, so an Anthropic key placed there is readable by
   anyone who downloads the app. Coach calls have to go through an Edge
   Function holding the key server-side — which is also where
   `claim_coach_question()` gets called, so the quota can't be bypassed by
   calling the model directly. That function is the piece the message `status`
   column exists for: rows are written `pending` and settled when generation
   finishes.

9. **Nothing here decides the system prompt.** `prompt_version` records *which*
   one a thread used; it does not store the text. Keep the prompt in the
   repository next to the Edge Function so it is reviewable, and bump the
   version when it changes.

## What the client actually uses

The seam held: screens read through `hooks/`, so migrating one means rewriting a
hook, not a screen tree.

| Wired to Postgres | Still reading `mocks/couple.ts` |
|---|---|
| Auth and pairing (`lib/pairing.ts`, `components/providers/auth-provider.tsx`) | Play and the tools |
| Home (`lib/home.ts` → `hooks/use-home.ts`) | Coach |
| Check-in and the need follow-up (`app/checkin.tsx`, `app/need.tsx`) | Calendar |
| Streak and level (`hooks/use-streak.ts`) | Premium / upgrade (`hooks/use-premium.ts`) |
| Us — goals, bucket list, wiki, love languages (`lib/us.ts`) | The level ladder itself, which is static reference data |
| Private reminders (`lib/todos.ts` → `hooks/use-todos.ts`) | |

### Realtime

Both partners are looking at the same rows on two devices, so a write on one
has to reach the other without a reload. `0009_realtime.sql` publishes the
shared tables; `components/providers/realtime-provider.tsx` opens **one** channel
per couple and hands screens a way to name the tables they care about.

A change is treated as a **signal, not as data** — the subscribing hook re-runs
its own query rather than merging the payload. That is one extra round trip per
change, and it avoids three problems: `fetchHomeSnapshot` joins profiles and
filters on today's date, so a row-level payload cannot be folded into its result
without reimplementing the query on the client; a DELETE carries only the
primary key unless the table is `REPLICA IDENTITY FULL`; and a patched cache is
a second copy of the truth that has to stay right forever.

The focus refetch stays as the backstop. A socket that was backgrounded or
offline misses events, and no realtime system removes the need to re-read on the
way back in.

Two things to know before adding a table:

- **Publish it in 0009 or the channel errors.** `CHANNEL_ERROR` on subscribe
  almost always means the table is missing from the publication; the provider
  logs that in development.
- **Filters need a column.** Most tables are subscribed with
  `couple_id=eq.<id>`. `profiles` and `love_languages` have no such column and
  are subscribed unfiltered — Realtime evaluates their `shares_couple_with`
  policies per subscriber, so publishing them does not widen who can read them,
  but it does mean the server checks every change in those tables against every
  subscriber. Worth revisiting if either grows.

`hooks/use-async-data.ts` is the only fetching primitive — loading/error/refetch
plus a refetch on screen focus, which is how home picks up a check-in written by
a sheet without the two routes sharing state. There is no client-side cache; add
one when two screens want the same rows at the same time.

Two schema facts the home screen had to be built around, worth knowing before
changing either:

- **`checked_on_partner` lives on `check_ins`**, whose `mood` and `battery` are
  `not null`. So the "I've checked up on them" control cannot create its own
  row — inventing a mood to hold the flag would also feed the mutual-day streak
  trigger. Home only offers the control once that day's check-in exists.
- **`entry_date` defaults to UTC**, so the client computes "today" in UTC too
  (`todayKey()` in `lib/home.ts`). Using the device's local date would put the
  two sides of the one-per-day unique constraint on different days. Open
  question 1 below is the real fix.

**Never put the `service_role` key in `.env`.** Anything prefixed
`EXPO_PUBLIC_` is compiled into the app bundle, and that key bypasses every
policy in `0007`.
