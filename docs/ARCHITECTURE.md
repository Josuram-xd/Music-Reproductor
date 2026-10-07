# Purrlist — Arquitectura

## Stack
| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript strict | Nativo en Vercel, Route Handlers para el backend ligero |
| Estilos | Tailwind CSS v4 + CSS variables | Tema oscuro kawaii con tokens |
| Estado | Zustand | Store simple que envuelve las estructuras de datos propias |
| Drag & drop | dnd-kit | Accesible (teclado), soporta listas ordenables y entre contenedores |
| Backend | Supabase (Auth + Postgres + Storage) | Sí funciona con Vercel; RLS protege los datos de cada usuario |
| Tests | Vitest (unit) + Playwright (e2e) | |

## ¿Supabase funciona? Sí, con 3 cuidados
1. **Subidas directas a Storage desde el navegador** (signed upload URL / TUS resumable). Vercel corta los bodies a ~4.5 MB en funciones, así que los archivos **nunca** pasan por Next.
2. **Límites del plan Free**: 1 GB de Storage total y 50 MB por archivo. **No se guardan vídeos**: de un vídeo subido se extrae el audio en el navegador y solo se sube el audio (ver "Vídeos locales").
3. **Claves de terceros cifradas**: los secretos de usuario se guardan cifrados (AES‑GCM en servidor con `ENCRYPTION_KEY` en Vercel, o Supabase Vault). Nunca llegan al cliente.

## Usuarios y roles
- `owner` (tú): usa las claves del servidor (`SPOTIFY_CLIENT_ID`, `YOUTUBE_API_KEY` en env de Vercel). Todo conectado.
- `user` (registro público): sube sus archivos, usa YouTube con la key compartida y conecta **su propia app de Spotify** (Client ID propio, flujo PKCE → no hace falta secret).
- Rol en `profiles.role`; el primer usuario se marca `owner` por SQL.

## Fuentes de reproducción (patrón Adapter)
```
PlayerEngine ── usa ──> PlaybackSource (interfaz)
                         ├─ LocalAudioSource   (HTMLAudioElement, archivo de Storage vía signed URL)
                         ├─ YouTubeSource      (IFrame Player API — reproductor visible, ToS)
                         └─ SpotifySource      (Web Playback SDK — requiere Premium)
interface PlaybackSource { load(t); play(); pause(); seek(s); getTime(); getDuration(); on('ended'|'time'|'error') }
```
- YouTube: solo reproducción embebida (no se extrae audio; violaría los ToS). Búsqueda vía `/api/youtube/search` (oculta la key). Cuota gratis 10.000 unidades/día ≈ 100 búsquedas/día compartidas → cache de resultados en Postgres. Si la cuota compartida se agota, el usuario puede pegar **su propia API key** en Integraciones (cifrada; se usa con prioridad sobre la compartida).
- YouTube **sí muestra el vídeo** (mini‑reproductor en el panel "Ahora suena").
- Spotify: solo audio; el SDK no expone vídeo ni Canvas. Web Playback SDK exige cuenta Premium.

## Vídeos locales → solo audio
- El usuario arrastra un `.mp4/.mkv/.webm/.mov…`; en el navegador **ffmpeg.wasm** (build single‑thread, no necesita COOP/COEP, que romperían el iframe de YouTube) hace `-vn -c:a copy` (sin recodificar, rápido). Si el códec no cabe en el contenedor, recodifica a AAC/Opus.
- Se sube solo el audio resultante (`source = 'audio'`, `origin = 'video'`). El vídeo nunca sale del PC.
- ffmpeg.wasm (~30 MB) se carga bajo demanda, solo la primera vez que se sube un vídeo. Las apps en "development mode" solo admiten usuarios en allowlist, por eso cada usuario usa su propio Client ID.

## Estructuras de datos (`src/lib/ds/`)
| Estructura | Uso |
|---|---|
| **Lista doblemente enlazada** `DoublyLinkedList<T>` + `Map<id, Node>` | Cola de reproducción: next/prev O(1), mover/insertar/quitar O(1) con el índice |
| **Lista doble circular** | Modo repetir-todo |
| **Pila** `Stack<T>` | Historial (doble back) y pila de deshacer de la cola |
| **Command pattern + pila undo/redo** | Revertir movimientos (p. ej. "fue un error") |
| **Árbol n-ario** `FolderTree` | Carpetas anidadas de la biblioteca |
| **Trie** | Autocompletado de búsqueda en la biblioteca |
| **Cache LRU** (Map + lista doble) | Signed URLs / blobs ya cargados |
| **Fisher‑Yates** sobre array | Shuffle reproducible |

Las estructuras son puras (sin React), 100 % testeadas; el store de Zustand las envuelve y emite snapshots inmutables a la UI.

## Funciones clave

### Arrastrar a la primera posición (sobre la que suena)
Cuando el drop cae en el índice 0 (encima de "Ahora suena"):
1. Se aplica el movimiento como `MoveCommand` (push en la pila undo) y se abre un modal:
   - ⚠️ **Reproducir ahora** — aviso: la canción actual se corta y empieza la arrastrada.
   - ↩️ **Fue un error** — `undo()` restaura la posición original.
   - ⏭️ **Ponerla a continuación** — se recoloca justo después de la actual.
2. `Esc` / clic fuera = "Fue un error" (opción segura).
3. Checkbox **"No volver a preguntar en esta sesión"** (aplica a *Reproducir ahora* y *A continuación*): guarda la elección en `sessionStorage`; los siguientes drops la aplican directo con un toast "↩️ Deshacer" de 5 s. Se resetea al cerrar sesión. Se puede reactivar en Ajustes.

## Sesión
- **Al cerrar la app hay que volver a iniciar sesión**, pero con una **ventana de gracia** (por defecto 5 min, `SESSION_GRACE_SECONDS`) para cierres accidentales o cortes de red.
- Mecanismo: el cliente manda un heartbeat cada 30 s a `/api/session/heartbeat`, que renueva una cookie httpOnly firmada `pl_last_seen`. El middleware, en cada carga, compara `now - last_seen`: si supera la gracia → `signOut()` y redirige a `/login?reason=expired`.
- Pestaña cerrada → no hay heartbeat → al reabrir pasada la gracia, pide login. Reabrir dentro de la gracia → sigue la sesión (y la cola restaurada).
- **Sin red** (`offline` / heartbeat fallido): overlay kawaii "Reconectando… tu sesión sigue viva 4:32" con cuenta atrás; lo que ya está en buffer sigue sonando. Al volver la red: refresh del token de Supabase + heartbeat. Si la cuenta llega a 0 → logout limpio.
- Supabase sigue gestionando access/refresh tokens; la gracia es una capa propia encima (el timeout de inactividad nativo es solo del plan Pro).

### Doble back
- Si `currentTime > 3 s` → reinicia la canción. Si se vuelve a pulsar en < 1.5 s o `currentTime ≤ 3 s` → va a la anterior (pila de historial).
- Si no hay anterior → toast de aviso "Es la primera canción, nya~ 🐾".
- Seek: barra arrastrable, ±10 s con botones y ←/→; espacio = play/pausa.

## Modelo de datos (Postgres, todo con RLS `owner_id = auth.uid()`)
```
profiles(id → auth.users, username, avatar_url, role 'owner'|'user')
folders(id, owner_id, parent_id → folders, name, created_at)
tracks(id, owner_id, folder_id, source 'audio'|'youtube'|'spotify', origin 'file'|'video',
       title, artist, duration_s, storage_path, external_id, mime, cover_path)
playlists(id, owner_id, name, cover_path)
playlist_items(playlist_id, track_id, rank text)   -- rank fraccional (lexorank) para reordenar sin reescribir
queue_state(owner_id PK, track_ids uuid[], current_index, updated_at)
user_integrations(owner_id, provider 'spotify'|'youtube', client_id, secret_enc, refresh_token_enc, expires_at)
yt_search_cache(query PK, results jsonb, fetched_at)
```
Buckets: `media` (privado, ruta `{uid}/{trackId}.{ext}`), `covers`.

## Estructura de carpetas
```
src/
  app/(auth)/login, register
  app/(app)/library, playlists, queue, settings/integrations
  app/api/youtube/search, spotify/token, upload/sign, session/heartbeat
  lib/media/       extracción de audio (ffmpeg.wasm)
  components/player, queue, library, ui (kawaii)
  lib/ds/          estructuras de datos + tests
  lib/player/      PlayerEngine + sources
  lib/supabase/    clientes server/browser
  stores/          zustand
supabase/migrations/
```
