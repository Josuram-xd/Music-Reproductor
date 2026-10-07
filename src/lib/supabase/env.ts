/**
 * Checks that the Supabase URL is the project API URL
 * (`https://<ref>.supabase.co`), not the dashboard URL
 * (`https://supabase.com/dashboard/project/<ref>`), a mistake that breaks
 * every auth call with confusing 404s.
 */
export function assertSupabaseApiUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: "${url}"`);
  }
  if (parsed.hostname === "supabase.com" || parsed.hostname.endsWith(".supabase.com")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL points to the Supabase dashboard. Use the project API URL " +
        "instead: https://<project-ref>.supabase.co (Project Settings → Data API).",
    );
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must not have a path ("${parsed.pathname}"): use https://<project-ref>.supabase.co`,
    );
  }
}

/**
 * Public Supabase settings. `process.env.NEXT_PUBLIC_*` must be accessed
 * literally so Next.js can inline them into the browser bundle.
 */
export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)",
    );
  }
  assertSupabaseApiUrl(url);
  return { url, key };
}
