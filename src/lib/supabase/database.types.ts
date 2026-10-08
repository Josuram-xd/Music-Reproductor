// Hand-written to match supabase/migrations. Can be replaced later with
// `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

export type Role = "owner" | "user";
export type TrackSourceColumn = "audio" | "youtube" | "spotify";
export type TrackOrigin = "file" | "video";

// `type` (not `interface`): supabase-js needs rows assignable to Record<string, unknown>.
export type FolderRow = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
};

export type TrackRow = {
  id: string;
  owner_id: string;
  folder_id: string | null;
  source: TrackSourceColumn;
  origin: TrackOrigin;
  title: string;
  artist: string | null;
  duration_s: number | null;
  storage_path: string | null;
  external_id: string | null;
  mime: string | null;
  size_bytes: number | null;
  cover_path: string | null;
  created_at: string;
};

export type PlaylistRow = {
  id: string;
  owner_id: string;
  name: string;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaylistItemRow = {
  playlist_id: string;
  track_id: string;
  owner_id: string;
  rank: string;
  added_at: string;
};

export type QueueStateRow = {
  owner_id: string;
  track_ids: string[];
  current_index: number | null;
  position_s: number;
  updated_at: string;
};

export type YouTubeSearchCacheRow = {
  query: string;
  /** `YouTubeResult[]` (src/lib/youtube/types.ts). */
  results: unknown;
  fetched_at: string;
};

export type IntegrationProvider = "youtube" | "spotify";

export type UserIntegrationRow = {
  owner_id: string;
  provider: IntegrationProvider;
  client_id: string | null;
  secret_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  secret_hint: string | null;
  account_name: string | null;
  account_product: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSettingsRow = {
  owner_id: string;
  floating_player: boolean;
  /** `FloatingPosition` (src/lib/settings/settings.ts). */
  floating_pos: unknown;
  radio_enabled: boolean;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          role: Role;
          created_at: string;
        };
        Insert: never;
        Update: {
          username?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      folders: {
        Row: FolderRow;
        Insert: Pick<FolderRow, "name"> & Partial<Pick<FolderRow, "id" | "parent_id">>;
        Update: Partial<Pick<FolderRow, "name" | "parent_id">>;
        Relationships: [];
      };
      tracks: {
        Row: TrackRow;
        Insert: Pick<TrackRow, "source" | "title"> &
          Partial<Omit<TrackRow, "owner_id" | "created_at" | "source" | "title">>;
        Update: Partial<
          Pick<TrackRow, "folder_id" | "title" | "artist" | "duration_s" | "cover_path">
        >;
        Relationships: [];
      };
      playlists: {
        Row: PlaylistRow;
        Insert: Pick<PlaylistRow, "name"> & Partial<Pick<PlaylistRow, "id" | "cover_path">>;
        Update: Partial<Pick<PlaylistRow, "name" | "cover_path">>;
        Relationships: [];
      };
      playlist_items: {
        Row: PlaylistItemRow;
        Insert: Pick<PlaylistItemRow, "playlist_id" | "track_id" | "rank">;
        Update: Partial<Pick<PlaylistItemRow, "rank">>;
        Relationships: [];
      };
      yt_search_cache: {
        Row: YouTubeSearchCacheRow;
        Insert: Pick<YouTubeSearchCacheRow, "query" | "results"> &
          Partial<Pick<YouTubeSearchCacheRow, "fetched_at">>;
        Update: Partial<Pick<YouTubeSearchCacheRow, "results" | "fetched_at">>;
        Relationships: [];
      };
      user_integrations: {
        Row: UserIntegrationRow;
        Insert: Pick<UserIntegrationRow, "provider"> &
          Partial<Omit<UserIntegrationRow, "provider" | "created_at">>;
        Update: Partial<Omit<UserIntegrationRow, "owner_id" | "provider" | "created_at">>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: Pick<UserSettingsRow, "owner_id"> & Partial<Omit<UserSettingsRow, "owner_id">>;
        Update: Partial<Omit<UserSettingsRow, "owner_id">>;
        Relationships: [];
      };
      queue_state: {
        Row: QueueStateRow;
        Insert: Pick<QueueStateRow, "owner_id"> & Partial<Omit<QueueStateRow, "owner_id">>;
        Update: Partial<Omit<QueueStateRow, "owner_id">>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
