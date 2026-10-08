-- Playlists: any number per user, each an ordered list of library tracks.
-- Order uses fractional ranks (src/lib/ds/fractional-rank.ts): moving a track
-- only rewrites its own `rank`, never the rest of the playlist.

-- Lets playlist_items reference (track_id, owner_id), so a playlist can only
-- hold tracks of the same user.
alter table public.tracks add constraint tracks_id_owner_key unique (id, owner_id);

-- ── playlists ──────────────────────────────────────────────────────────────

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  -- Optional uploaded cover (covers/{uid}/…); without it the UI shows a mosaic.
  cover_path text check (cover_path is null or cover_path like owner_id::text || '/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create index playlists_owner_created_idx on public.playlists (owner_id, created_at desc);

-- ── playlist_items ─────────────────────────────────────────────────────────

create table public.playlist_items (
  playlist_id uuid not null,
  track_id uuid not null,
  owner_id uuid not null default auth.uid(),
  -- Byte order ("C" collation) is the order the rank algorithm relies on.
  rank text collate "C" not null check (rank ~ '^[0-9a-z]*[1-9a-z]$' and char_length(rank) <= 64),
  added_at timestamptz not null default now(),
  -- A track appears at most once per playlist.
  primary key (playlist_id, track_id),
  -- Checked at the end of each statement, so a rebalance (one bulk upsert
  -- rewriting every rank) can swap keys between rows.
  unique (playlist_id, rank) deferrable initially immediate,
  foreign key (playlist_id, owner_id) references public.playlists (id, owner_id)
    on delete cascade,
  -- Deleting a track from the library removes it from its playlists.
  foreign key (track_id, owner_id) references public.tracks (id, owner_id) on delete cascade
);

create index playlist_items_track_idx on public.playlist_items (track_id);

-- Any change to the items bumps the playlist's updated_at (newest first in the list).
create function public.touch_playlist()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.playlists set updated_at = now()
  where id = coalesce(new.playlist_id, old.playlist_id);
  return null;
end;
$$;

create trigger playlist_items_touch
  after insert or update or delete on public.playlist_items
  for each row execute function public.touch_playlist();

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;

create policy "playlists: owner reads" on public.playlists for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "playlists: owner inserts" on public.playlists for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "playlists: owner updates" on public.playlists for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "playlists: owner deletes" on public.playlists for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "playlist_items: owner reads" on public.playlist_items for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "playlist_items: owner inserts" on public.playlist_items for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "playlist_items: owner updates" on public.playlist_items for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "playlist_items: owner deletes" on public.playlist_items for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.playlists, public.playlist_items from anon;
