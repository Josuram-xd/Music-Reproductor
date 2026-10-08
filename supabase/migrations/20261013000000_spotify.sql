-- Spotify connection details shown in Ajustes (who is connected and whether
-- the account is Premium, which the Web Playback SDK requires).

alter table public.user_integrations
  add column account_name text check (account_name is null or char_length(account_name) <= 200),
  add column account_product text check (account_product is null or char_length(account_product) <= 40);
