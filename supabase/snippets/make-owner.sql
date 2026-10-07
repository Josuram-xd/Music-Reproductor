-- Promotes an existing user to `owner`. Run it once in the Supabase SQL editor
-- (it runs as the postgres role, which bypasses RLS and column grants).
-- Replace the email with the owner's account.

update public.profiles
set role = 'owner'
where id = (select id from auth.users where email = 'owner@example.com');

-- Check:
-- select p.role, u.email from public.profiles p join auth.users u on u.id = p.id;
