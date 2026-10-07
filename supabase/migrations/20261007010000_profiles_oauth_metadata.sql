-- OAuth sign-ups (Google) send `full_name`/`name` and `avatar_url`/`picture`
-- instead of our `username`. Use them as a fallback when creating the profile.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested text := trim(coalesce(
    nullif(trim(meta ->> 'username'), ''),
    nullif(trim(meta ->> 'full_name'), ''),
    nullif(trim(meta ->> 'name'), '')
  ));
  avatar text := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
begin
  -- Long OAuth names are cut to the 30-char limit; too short ones are dropped.
  requested := trim(left(requested, 30));
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    case when char_length(requested) >= 3 then requested end,
    avatar
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
