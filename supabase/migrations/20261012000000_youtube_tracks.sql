-- YouTube videos saved to the library are `tracks` rows (source 'youtube',
-- external_id = video id). Saving the same video twice keeps a single row.

create unique index tracks_owner_external_idx
  on public.tracks (owner_id, source, external_id)
  where external_id is not null;
