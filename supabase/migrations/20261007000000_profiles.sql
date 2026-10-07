-- Profiles: one row per auth user, created automatically on sign-up.
-- The role is never writable by users; the owner is promoted by SQL
-- (see supabase/snippets/make-owner.sql).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text check (username is null or char_length(username) between 3 and 30),
  avatar_url text,
  role text not null default 'user' check (role in ('owner', 'user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Rows are only created by the trigger below. Users may edit their display
-- fields, but never `role` (column-level grant).
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := trim(new.raw_user_meta_data ->> 'username');
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    case when char_length(requested) between 3 and 30 then requested end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users that signed up before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
