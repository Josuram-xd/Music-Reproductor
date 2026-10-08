-- Playback queue of each user, restored when they come back (docs/ARCHITECTURE.md).
-- One row per user: track ids in queue order, the loaded one and its position.

create table public.queue_state (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  track_ids uuid[] not null default '{}' check (cardinality(track_ids) <= 2000),
  current_index integer check (
    current_index is null or (current_index >= 0 and current_index < cardinality(track_ids))
  ),
  position_s numeric(10, 3) not null default 0 check (position_s >= 0),
  updated_at timestamptz not null default now()
);

alter table public.queue_state enable row level security;

create policy "queue_state: owner reads" on public.queue_state for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "queue_state: owner inserts" on public.queue_state for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "queue_state: owner updates" on public.queue_state for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "queue_state: owner deletes" on public.queue_state for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.queue_state from anon;
