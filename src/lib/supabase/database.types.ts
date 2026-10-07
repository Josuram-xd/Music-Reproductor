// Hand-written to match supabase/migrations. Can be replaced later with
// `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

export type Role = "owner" | "user";

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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
