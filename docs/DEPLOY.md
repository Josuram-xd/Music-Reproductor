# Purrlist — Despliegue

Producción: **https://purrlist-ten.vercel.app** (Vercel, proyecto `purrlist`, conectado a `Josuram-xd/Music-Reproductor`). Cada push a `main` se despliega solo; cada PR recibe un preview.

## 1. Variables de entorno (Vercel → Settings → Environment Variables)

Todas en **Production** y **Preview**. `npm run check:env` las comprueba en local y el build de Vercel lo hace antes de compilar (`prebuild`): falla sin las dos de Supabase y avisa del resto.

| Variable                               | Para qué                                   | Cómo obtenerla                                                       |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Todo (auth, datos)                         | Supabase → Project Settings → Data API (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Todo (auth, datos)                         | Supabase → Project Settings → API Keys                               |
| `SUPABASE_SECRET_KEY`                  | Caché compartida de búsquedas de YouTube   | Supabase → API Keys → secret key                                     |
| `SESSION_COOKIE_SECRET`                | Ventana de gracia de la sesión             | `openssl rand -base64 48`                                            |
| `SESSION_GRACE_SECONDS`                | Duración de la gracia (por defecto 300)    | —                                                                    |
| `ENCRYPTION_KEY`                       | Cifrar keys de YouTube y tokens de Spotify | `openssl rand -base64 32` (**no cambiarla**: lo cifrado se perdería) |
| `YOUTUBE_API_KEY`                      | Búsqueda de YouTube compartida             | Google Cloud → YouTube Data API v3 → credenciales                    |
| `SPOTIFY_CLIENT_ID`                    | Spotify del owner                          | developer.spotify.com → tu app → Settings                            |

Estado (7 oct 2026): las 8 están creadas en Production y Preview.

## 2. Base de datos (Supabase)

Aplicar las migraciones de `supabase/migrations/` **en orden** (SQL Editor o `supabase db push`):

1. `20261007000000_profiles.sql`
2. `20261007010000_profiles_oauth_metadata.sql`
3. `20261008000000_library.sql`
4. `20261009000000_queue_state.sql`
5. `20261010000000_playlists.sql`
6. `20261011000000_youtube_search.sql`
7. `20261012000000_youtube_tracks.sql`
8. `20261013000000_spotify.sql`
9. `20261014000000_user_settings.sql`
10. `20261015000000_radio.sql`
11. `20261016000000_stats.sql`
12. `20261017000000_stats_by_source.sql`

Y en **Authentication → URL Configuration**:

- Site URL: `https://purrlist-ten.vercel.app`
- Redirect URLs: `https://purrlist-ten.vercel.app/**`, `https://*-josuram.vercel.app/**` (previews) y `http://localhost:3000/**`.

## 3. Integraciones

- **Google (login)**: en Google Cloud → OAuth client, el redirect autorizado es el callback de Supabase (`https://<ref>.supabase.co/auth/v1/callback`); no cambia con el dominio.
- **Spotify**: en developer.spotify.com → tu app → Settings → **Redirect URIs**, añadir:
  - `https://purrlist-ten.vercel.app/api/spotify/callback`
  - `http://127.0.0.1:3000/api/spotify/callback` (local; Spotify no acepta `localhost`)
  - Cada usuario que use su propio Client ID añade la de producción en su app (la guía de Ajustes se la enseña).
- **YouTube**: restringir la key a "YouTube Data API v3". No restringirla por referer: la usa el servidor.

## 4. Dominio propio (opcional)

Vercel → Settings → Domains → añadir el dominio y crear los DNS que indique. Después repetir con el dominio nuevo: Site URL y Redirect URLs de Supabase (paso 2) y Redirect URI de Spotify (paso 3).

## 5. CI (GitHub Actions)

`.github/workflows/ci.yml` corre en cada PR y push a `main`: `typecheck`, `lint`, `format:check` y tests unitarios. No necesita secretos. El job se llama **`CI / checks`**.

## 6. Protección de la rama `main`

GitHub → Settings → Rules → **Rulesets** → New branch ruleset:

- Name: `main`; Enforcement: **Active**; Target: **Default branch**.
- ✅ **Restrict deletions** y ✅ **Block force pushes**.
- ✅ **Require status checks to pass** → añadir `checks` (aparece tras el primer run del CI).
- Bypass list: añadir **Repository admin** si quieres seguir haciendo push directo a `main` (los PRs de otros sí tendrán que pasar el CI). Sin bypass, todo cambio irá por PR.

## 7. Desplegar y volver atrás

- Desplegar: merge/push a `main`. El build ejecuta `check:env` → `copy-ffmpeg` → `next build`.
- Rollback: Vercel → Deployments → un despliegue anterior en READY → **Promote to Production** (instantáneo, sin rebuild).
- Las migraciones no se deshacen solas: si una falla, corregirla con una migración nueva.
