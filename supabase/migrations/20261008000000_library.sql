-- Library: folders (n-ary tree), tracks and the private Storage buckets.
-- Every row belongs to one user; RLS only lets them see and change their own.

-- ── folders ────────────────────────────────────────────────────────────────

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  -- Lets children reference (id, owner_id), so a folder can only live inside
  -- a folder of the same user.
  unique (id, owner_id),
  foreign key (parent_id, owner_id) references public.folders (id, owner_id) on delete cascade,
  check (parent_id is distinct from id)
);

create index folders_owner_parent_idx on public.folders (owner_id, parent_id);

-- Moving a folder inside one of its own descendants would create a cycle.
create function public.prevent_folder_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    with recursive ancestors as (
      select f.id, f.parent_id from public.folders f where f.id = new.parent_id
      union all
      select f.id, f.parent_id from public.folders f join ancestors a on f.id = a.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A folder cannot be moved inside itself' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger folders_prevent_cycle
  before update of parent_id on public.folders
  for each row execute function public.prevent_folder_cycle();

-- ── tracks ─────────────────────────────────────────────────────────────────

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid,
  source text not null check (source in ('audio', 'youtube', 'spotify')),
  origin text not null default 'file' check (origin in ('file', 'video')),
  title text not null check (char_length(trim(title)) between 1 and 300),
  artist text check (artist is null or char_length(artist) <= 300),
  duration_s numeric(10, 3) check (duration_s is null or duration_s >= 0),
  storage_path text,
  external_id text,
  mime text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  cover_path text,
  created_at timestamptz not null default now(),
  -- Deleting a folder keeps its tracks (they move to the library root).
  foreign key (folder_id, owner_id) references public.folders (id, owner_id)
    on delete set null (folder_id),
  -- Uploaded files live under the owner's folder: media/{uid}/{trackId}.{ext}
  check (storage_path is null or storage_path like owner_id::text || '/%'),
  check (source <> 'audio' or storage_path is not null),
  check (source = 'audio' or external_id is not null),
  unique (storage_path)
);

create index tracks_owner_folder_idx on public.tracks (owner_id, folder_id);
create index tracks_owner_created_idx on public.tracks (owner_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.folders enable row level security;
alter table public.tracks enable row level security;

create policy "folders: owner reads" on public.folders for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "folders: owner inserts" on public.folders for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "folders: owner updates" on public.folders for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "folders: owner deletes" on public.folders for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "tracks: owner reads" on public.tracks for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "tracks: owner inserts" on public.tracks for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "tracks: owner updates" on public.tracks for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "tracks: owner deletes" on public.tracks for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.folders, public.tracks from anon;

-- ── Storage ────────────────────────────────────────────────────────────────
-- Private buckets. Free plan: 50 MB per file. Videos are never stored: the
-- browser extracts their audio and only that is uploaded.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', false, 52428800, array['audio/*']),
  ('covers', 'covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored as {bucket}/{uid}/…; users only touch their own folder.
create policy "media/covers: owner reads" on storage.objects for select to authenticated
  using (bucket_id in ('media', 'covers')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media/covers: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id in ('media', 'covers')
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media/covers: owner updates" on storage.objects for update to authenticated
  using (bucket_id in ('media', 'covers')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media/covers: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id in ('media', 'covers')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
