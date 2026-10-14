-- ============================================================================
-- 0030 · In-app feedback and safety reports
--
-- Google Play's Child Safety Standards policy requires a way to send feedback
-- or raise a concern *without leaving the app*. Settings used to link "Help &
-- support" out to the website, which does not count. This is the in-app half:
-- the Feedback screen writes a row here and nothing else.
--
-- Write-only from the client. Nobody reads feedback back through the app,
-- their own included, so there is an insert policy and no select policy. It
-- is read in the Supabase dashboard (or by the service role).
-- ============================================================================

create table if not exists public.feedback (
  id          uuid        primary key default gen_random_uuid(),

  -- `set null`, not `cascade`: a safety report has to outlive the account that
  -- filed it. Deleting your account removes who sent it, not what was said.
  user_id     uuid        references public.profiles (id) on delete set null
                          default auth.uid(),

  kind        text        not null,
  message     text        not null,

  -- Optional reply address, for when the account email is not the one the
  -- person wants to be answered on.
  contact     text,

  -- Diagnostics only.
  app_version text,
  platform    text,

  created_at  timestamptz not null default now(),

  constraint feedback_kind check (kind in ('feedback', 'bug', 'safety')),
  constraint feedback_message_shape check (char_length(trim(message)) between 1 and 4000),
  constraint feedback_contact_shape check (contact is null or char_length(contact) <= 320)
);

create index if not exists feedback_by_created on public.feedback (created_at desc);
create index if not exists feedback_safety on public.feedback (created_at desc)
  where kind = 'safety';

alter table public.feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'feedback'
      and policyname = 'file own feedback'
  ) then
    create policy "file own feedback"
      on public.feedback for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

revoke all on public.feedback from anon;
revoke select, update, delete on public.feedback from authenticated;
grant insert on public.feedback to authenticated;
