-- Time listened per source (files, YouTube, Spotify) in a period, for "Mis stats".

create function public.stats_by_source(p_since timestamptz)
returns table (source text, listened_s numeric, plays bigint)
language sql
stable
set search_path = ''
as $$
  select e.source, sum(e.listened_s), count(*)
  from public.play_events e
  where e.owner_id = auth.uid() and e.started_at >= p_since
  group by e.source;
$$;

revoke execute on function public.stats_by_source(timestamptz) from anon, public;
grant execute on function public.stats_by_source(timestamptz) to authenticated;
