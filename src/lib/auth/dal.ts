import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { HOME_PATH, LOGIN_PATH } from "./routes";

export interface CurrentUser {
  id: string;
  email: string;
  username: string | null;
  role: Role;
}

/**
 * Data Access Layer: the verified current user, or `null`. Deduplicated per
 * request with React `cache`. Reads cookies, so callers must render inside
 * a `<Suspense>` boundary (Cache Components).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    username: profile?.username ?? null,
    role: profile?.role ?? "user",
  };
});

/** The current user, or a redirect to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** The current user if they are the owner, otherwise a redirect home. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "owner") redirect(HOME_PATH);
  return user;
}
