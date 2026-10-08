// Checks the environment before `next build` (and on demand: `npm run check:env`).
// Fails only without the public Supabase settings, which nothing works without;
// everything else is a warning naming the feature that will not work.
import { existsSync, readFileSync } from "node:fs";

/** Local runs read .env.local like Next.js does; Vercel injects real env vars. */
function loadDotEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const value = (name) => (process.env[name] ?? "").trim();

/** [name, check (returns an error text or null), what breaks without it]. */
const REQUIRED = [
  [
    "NEXT_PUBLIC_SUPABASE_URL",
    (v) =>
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v)
        ? null
        : "must be https://<ref>.supabase.co",
    "everything (auth, data)",
  ],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", () => null, "everything (auth, data)"],
];

const OPTIONAL = [
  ["SUPABASE_SECRET_KEY", () => null, "the shared YouTube search cache"],
  [
    "SESSION_COOKIE_SECRET",
    (v) => (v.length >= 32 ? null : "should be at least 32 characters"),
    "the session grace window",
  ],
  [
    "ENCRYPTION_KEY",
    (v) =>
      Buffer.from(v, "base64").length === 32
        ? null
        : "must be 32 bytes in base64 (openssl rand -base64 32)",
    "saving YouTube keys and Spotify tokens",
  ],
  [
    "YOUTUBE_API_KEY",
    (v) => (/^AIza[0-9A-Za-z_-]{35}$/.test(v) ? null : "does not look like a Google API key"),
    "the shared YouTube search",
  ],
  [
    "SPOTIFY_CLIENT_ID",
    (v) => (/^[0-9a-f]{32}$/i.test(v) ? null : "must be 32 hex characters"),
    "Spotify for the owner",
  ],
];

function checkEnv() {
  const errors = [];
  const warnings = [];
  for (const [name, check, feature] of REQUIRED) {
    const v = value(name);
    const problem = v ? check(v) : "is missing";
    if (problem) errors.push(`${name} ${problem} → breaks ${feature}`);
  }
  for (const [name, check, feature] of OPTIONAL) {
    const v = value(name);
    const problem = v ? check(v) : "is missing";
    if (problem) warnings.push(`${name} ${problem} → disables ${feature}`);
  }
  return { errors, warnings };
}

// Type-checking and unit tests in CI need no secrets: nothing to check there.
if (process.env.CI && !process.env.VERCEL) process.exit(0);
loadDotEnvLocal();
const { errors, warnings } = checkEnv();
for (const warning of warnings) console.warn(`⚠ env: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`✖ env: ${error}`);
  console.error("See .env.example and docs/DEPLOY.md");
  process.exit(1);
}
console.log(
  `✓ env: required variables present${warnings.length ? ` (${warnings.length} warnings)` : ""}`,
);
