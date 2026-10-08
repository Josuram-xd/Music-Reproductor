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

export type QueueStateRow = {
  owner_id: string;
  track_ids: string[];
  current_index: number | null;
  position_s: number;
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
