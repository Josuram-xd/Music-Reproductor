-- "Mis stats": app usage sessions (fed by the heartbeat) and the stats_*
-- aggregates. They are SQL functions rather than plain views because they
-- take the period and the user's time zone (days, hours and streaks depend
-- on it). All are SECURITY INVOKER: RLS and auth.uid() keep them per user.

-- ── app_sessions ───────────────────────────────────────────────────────────

create table public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check (last_seen_at >= started_at)
);

create index app_sessions_owner_seen_idx on public.app_sessions (owner_id, last_seen_at desc);

alter table public.app_sessions enable row level security;

create policy "app_sessions: owner reads" on public.app_sessions for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "app_sessions: owner inserts" on public.app_sessions for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "app_sessions: owner updates" on public.app_sessions for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "app_sessions: owner deletes" on public.app_sessions for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.app_sessions from anon;

-- Heartbeat (every 30 s): extends the open session, or opens a new one if
-- the last sign of life is older than 2 minutes. Returns the session.
create function public.touch_app_session()
returns public.app_sessions
language plpgsql
set search_path = ''
as $$
declare
  session public.app_sessions;
begin
  update public.app_sessions
    set last_seen_at = now()
    where id = (
      select s.id from public.app_sessions s
      where s.owner_id = auth.uid() and s.last_seen_at > now() - interval '2 minutes'
      order by s.last_seen_at desc
      limit 1
    )
    returning * into session;
  if not found then
    insert into public.app_sessions (owner_id) values (auth.uid()) returning * into session;
  end if;
  return session;
end;
$$;

-- ── stats_summary: the KPI cards ──────────────────────────────────────────

create function public.stats_summary(p_tz text default 'UTC')
returns table (
  listened_s numeric,
  plays bigint,
  audio_s numeric,
  youtube_s numeric,
  spotify_s numeric,
  usage_s numeric,
  session_started_at timestamptz,
  streak_days integer
)
language sql
stable
set search_path = ''
as $$
  with events as (
    select * from public.play_events where owner_id = auth.uid()
  ),
  days as (
    select distinct (started_at at time zone p_tz)::date as day from events where listened_s > 0
  ),
  islands as (
    select day, day - (row_number() over (order by day))::integer as grp from days
  ),
  runs as (
    select max(day) as last_day, count(*)::integer as len from islands group by grp
  )
  select
    coalesce((select sum(e.listened_s) from events e), 0),
    (select count(*) from events),
    coalesce((select sum(e.listened_s) from events e where e.source = 'audio'), 0),
    coalesce((select sum(e.listened_s) from events e where e.source = 'youtube'), 0),
    coalesce((select sum(e.listened_s) from events e where e.source = 'spotify'), 0),
    coalesce((
      select sum(extract(epoch from s.last_seen_at - s.started_at))
      from public.app_sessions s where s.owner_id = auth.uid()
    ), 0)::numeric,
    (
      select s.started_at from public.app_sessions s
      where s.owner_id = auth.uid() and s.last_seen_at > now() - interval '2 minutes'
      order by s.last_seen_at desc
      limit 1
    ),
    -- A streak is alive if its last day is today or yesterday.
    coalesce((
      select r.len from runs r
      where r.last_day >= (now() at time zone p_tz)::date - 1
      order by r.last_day desc
      limit 1
    ), 0);
$$;

-- ── stats_top: most listened tracks / artists / folders in a period ───────

create function public.stats_top(p_kind text, p_since timestamptz, p_limit integer default 5)
returns table (key text, label text, sublabel text, listened_s numeric, plays bigint)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_kind = 'track' then
    return query
      select coalesce(e.track_id::text, e.source || ':' || coalesce(e.external_id, e.title)),
             max(e.title), max(e.artist), sum(e.listened_s), count(*)
      from public.play_events e
      where e.owner_id = auth.uid() and e.started_at >= p_since
      group by 1
      order by 4 desc, 5 desc
      limit p_limit;
  elsif p_kind = 'artist' then
    return query
      select lower(trim(e.artist)), max(trim(e.artist)), null::text, sum(e.listened_s), count(*)
      from public.play_events e
      where e.owner_id = auth.uid() and e.started_at >= p_since and nullif(trim(e.artist), '') is not null
      group by 1
      order by 4 desc, 5 desc
      limit p_limit;
  elsif p_kind = 'folder' then
    return query
      select f.id::text, max(f.name), null::text, sum(e.listened_s), count(*)
      from public.play_events e
      join public.tracks t on t.id = e.track_id
      join public.folders f on f.id = t.folder_id
      where e.owner_id = auth.uid() and e.started_at >= p_since
      group by f.id
      order by 4 desc, 5 desc
      limit p_limit;
  end if;
end;
$$;

-- ── stats_heatmap: listening by weekday (0 = Monday) × hour ───────────────

create function public.stats_heatmap(p_since timestamptz, p_tz text default 'UTC')
returns table (weekday integer, hour integer, listened_s numeric)
language sql
stable
set search_path = ''
as $$
  select (extract(isodow from e.started_at at time zone p_tz)::integer - 1),
         extract(hour from e.started_at at time zone p_tz)::integer,
         sum(e.listened_s)
  from public.play_events e
  where e.owner_id = auth.uid() and e.started_at >= p_since
  group by 1, 2;
$$;

-- ── stats_most_skipped: tracks skipped the most in a period ───────────────

create function public.stats_most_skipped(p_since timestamptz, p_limit integer default 5)
returns table (key text, label text, sublabel text, skips bigint, plays bigint)
language sql
stable
set search_path = ''
as $$
  select coalesce(e.track_id::text, e.source || ':' || coalesce(e.external_id, e.title)),
         max(e.title), max(e.artist), count(*) filter (where e.skipped), count(*)
  from public.play_events e
  where e.owner_id = auth.uid() and e.started_at >= p_since
  group by 1
  having count(*) filter (where e.skipped) > 0
  order by 4 desc, 5 desc
  limit p_limit;
$$;

revoke execute on function
  public.touch_app_session(),
  public.stats_summary(text),
  public.stats_top(text, timestamptz, integer),
  public.stats_heatmap(timestamptz, text),
  public.stats_most_skipped(timestamptz, integer)
from anon, public;
grant execute on function
  public.touch_app_session(),
  public.stats_summary(text),
  public.stats_top(text, timestamptz, integer),
  public.stats_heatmap(timestamptz, text),
  public.stats_most_skipped(timestamptz, integer)
to authenticated;
