# Purrlist — Arquitectura

## Stack

| Capa        | Elección                                 | Por qué                                                             |
| ----------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Framework   | Next.js (App Router) + TypeScript strict | Nativo en Vercel, Route Handlers para el backend ligero             |
| Estilos     | Tailwind CSS v4 + CSS variables          | Tema oscuro kawaii con tokens                                       |
| Estado      | Zustand                                  | Store simple que envuelve las estructuras de datos propias          |
| Drag & drop | dnd-kit                                  | Accesible (teclado), soporta listas ordenables y entre contenedores |
| Backend     | Supabase (Auth + Postgres + Storage)     | Sí funciona con Vercel; RLS protege los datos de cada usuario       |
| Tests       | Vitest (unit) + Playwright (e2e)         |                                                                     |

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
- Spotify: solo audio; el SDK no expone vídeo ni Canvas. Web Playback SDK exige cuenta Premium. Las apps en "development mode" solo admiten usuarios en allowlist, por eso cada usuario usa su propio Client ID.
- Spotify retiró `/recommendations` y `related-artists` para apps nuevas (nov. 2024): las recomendaciones no pueden depender de eso (ver "Radio neko").

## Vídeos locales → solo audio

- El usuario arrastra un `.mp4/.mkv/.webm/.mov…`; en el navegador **ffmpeg.wasm** (build single‑thread, no necesita COOP/COEP, que romperían el iframe de YouTube) hace `-vn -c:a copy` (sin recodificar, rápido). Si el códec no cabe en el contenedor, recodifica a AAC/Opus.
- Se sube solo el audio resultante (`source = 'audio'`, `origin = 'video'`). El vídeo nunca sale del PC.
- ffmpeg.wasm (~30 MB) se carga bajo demanda, solo la primera vez que se sube un vídeo.

## Estructuras de datos (`src/lib/ds/`)

| Estructura                                                            | Uso                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Lista doblemente enlazada** `DoublyLinkedList<T>` + `Map<id, Node>` | Cola de reproducción: next/prev O(1), mover/insertar/quitar O(1) con el índice |
| **Lista doble circular**                                              | Modo repetir-todo                                                              |
| **Pila** `Stack<T>`                                                   | Historial (doble back) y pila de deshacer de la cola                           |
| **Command pattern + pila undo/redo**                                  | Revertir movimientos (p. ej. "fue un error")                                   |
| **Árbol n-ario** `FolderTree`                                         | Carpetas anidadas de la biblioteca                                             |
| **Trie**                                                              | Autocompletado de búsqueda en la biblioteca                                    |
| **Cache LRU** (Map + lista doble)                                     | Signed URLs / blobs ya cargados                                                |
| **Fisher‑Yates** sobre array                                          | Shuffle reproducible                                                           |
| **Max‑Heap** (cola de prioridad) `PriorityQueue<T>`                   | Ranking de recomendaciones (Radio neko) y top‑N de estadísticas                |

Las estructuras son puras (sin React), 100 % testeadas; el store de Zustand las envuelve y emite snapshots inmutables a la UI.

## Funciones clave

### Arrastrar a la primera posición (sobre la que suena)

Cuando el drop cae en el índice 0 (encima de "Ahora suena"):

1. Se aplica el movimiento como `MoveCommand` (push en la pila undo) y se abre un modal:
   - ⚠️ **Reproducir ahora** — aviso: la canción actual se corta y empieza la arrastrada.
   - ↩️ **Fue un error** — `undo()` restaura la posición original.
   - ⏭️ **Ponerla a continuación** — se recoloca justo después de la actual.
2. `Esc` / clic fuera = "Fue un error" (opción segura).
3. Checkbox **"No volver a preguntar en esta sesión"** (aplica a _Reproducir ahora_ y _A continuación_): guarda la elección en `sessionStorage`; los siguientes drops la aplican directo con un toast "↩️ Deshacer" de 5 s. Se resetea al cerrar sesión. Se puede reactivar en Ajustes.

### Doble back

- Si `currentTime > 3 s` → reinicia la canción. Si se vuelve a pulsar en < 1.5 s o `currentTime ≤ 3 s` → va a la anterior (pila de historial).
- Si no hay anterior → toast de aviso "Es la primera canción, nya~ 🐾".
- Seek: barra arrastrable, ±10 s con botones y ←/→; espacio = play/pausa.

### Mini‑reproductor flotante (opcional, activado por defecto)

- Muestra carátula, título/artista, tiempo `1:23 / 3:45` con barra de progreso, y botones ⏮ ⏯ ⏭ (⏮ usa el doble back).
- **Opacidad**: 50 % cuando el ratón no está encima → 100 % con hover o foco de teclado (transición suave). En táctil (sin hover): semitransparente hasta que lo tocas; queda opaco 4 s tras el último toque.
- **Arrastrable** a cualquier punto; se pega al borde más cercano y recuerda la posición. Nunca tapa la cola ni se sale de la pantalla al redimensionar.
- **Activado** → sustituye a la barra fija de abajo. **Desactivado** (Ajustes, o la ✕ del propio widget con toast "Puedes volver a activarlo en Ajustes") → vuelve la barra fija clásica.
- **Botón "Sacar de la ventana"** (Chrome/Edge escritorio): usa la **Document Picture‑in‑Picture API** para que el mini‑reproductor flote **encima de otras apps**, ideal en pantalla dividida. En navegadores sin soporte el botón no aparece.
- En móvil, además, **Media Session API**: controles en la pantalla de bloqueo y en la notificación del sistema.

### Radio neko (cuando se acaba la cola)

- Toggle en Ajustes y en el panel de la cola (activado por defecto). Al quedar ≤ 1 canción en la cola, se añaden 5 recomendaciones marcadas con 🐾 "Recomendada"; el usuario puede quitarlas o pulsar "No me gusta" (penaliza ese artista).
- **Señales**: reproducciones completas (+), saltos en < 30 s (−), artistas/carpetas más escuchados, búsquedas recientes, hora del día.
- **Candidatos**, por orden:
  1. Tu propia biblioteca: canciones poco escuchadas de tus artistas/carpetas top.
  2. YouTube: búsqueda con tus artistas top (resultados cacheados para no gastar cuota).
  3. Spotify (si está conectado): búsqueda por artistas top (no hay endpoint de recomendaciones).
- Se puntúan y se eligen con un **Max‑Heap**; se excluye lo sonado en las últimas 2 h para no repetir.

## Estadísticas (menú "Mis stats")

- **Canción, artista y carpeta más escuchados** (top 5 / 10, por semana / mes / siempre).
- **Tiempo escuchado** total y por fuente (archivos, YouTube, Spotify).
- **Tiempo de uso de la app** (suma de sesiones) y **sesión actual** en vivo.
- **Racha** de días seguidos escuchando, **hora favorita** (mapa de calor día × hora), canciones más saltadas.
- Datos solo del propio usuario (RLS); botón "Borrar mi historial".
- Origen: `play_events` (se registra al terminar, saltar o cambiar de canción) y `app_sessions` (se alimenta del heartbeat de la sesión). Agregados con vistas SQL para no calcular en el cliente.

## Diseño responsive

- **Container queries** (no solo media queries): el layout reacciona al ancho real de la ventana, así funciona igual en pantalla dividida que en móvil.
- **< 640 px** (móvil / ventana estrecha): una columna, navegación en tabs abajo, la cola como bottom sheet deslizable, "Ahora suena" a pantalla completa.
- **640–1024 px** (tablet / pantalla dividida): sidebar compacto de solo iconos, la cola como panel lateral desplegable.
- **≥ 1024 px** (navegador completo): 3 columnas (sidebar · contenido · cola).
- Altura con `dvh` y `env(safe-area-inset-*)` (notch y barra de gestos), áreas táctiles ≥ 44 px.
- Drag & drop táctil: dnd-kit con `TouchSensor` y pulsación larga de 200 ms, para que deslizar haga scroll y no arrastre sin querer.

## Sesión

- **Al cerrar la app hay que volver a iniciar sesión**, pero con una **ventana de gracia** (por defecto 5 min, `SESSION_GRACE_SECONDS`) para cierres accidentales o cortes de red.
- Mecanismo: el cliente manda un heartbeat cada 30 s a `/api/session/heartbeat`, que renueva una cookie httpOnly firmada `pl_last_seen`. El middleware, en cada carga, compara `now - last_seen`: si supera la gracia → `signOut()` y redirige a `/login?reason=expired`.
- Pestaña cerrada → no hay heartbeat → al reabrir pasada la gracia, pide login. Reabrir dentro de la gracia → sigue la sesión (y la cola restaurada).
- **Sin red** (`offline` / heartbeat fallido): overlay kawaii "Reconectando… tu sesión sigue viva 4:32" con cuenta atrás; lo que ya está en buffer sigue sonando. Al volver la red: refresh del token de Supabase + heartbeat. Si la cuenta llega a 0 → logout limpio.
- Supabase sigue gestionando access/refresh tokens; la gracia es una capa propia encima (el timeout de inactividad nativo es solo del plan Pro).

## Modelo de datos (Postgres, todo con RLS `owner_id = auth.uid()`)

```
profiles(id → auth.users, username, avatar_url, role 'owner'|'user')
folders(id, owner_id, parent_id → folders, name, created_at)
tracks(id, owner_id, folder_id, source 'audio'|'youtube'|'spotify', origin 'file'|'video',
       title, artist, duration_s, storage_path, external_id, mime, cover_path)
playlists(id, owner_id, name, cover_path)
playlist_items(playlist_id, track_id, rank text)   -- rank fraccional (lexorank) para reordenar sin reescribir
queue_state(owner_id PK, track_ids uuid[], current_index, position_s, updated_at)
user_integrations(owner_id, provider 'spotify'|'youtube', client_id, secret_enc, refresh_token_enc, expires_at,
                  secret_hint)
yt_search_cache(query PK, results jsonb, fetched_at)
user_settings(owner_id PK, floating_player bool default true, floating_pos jsonb,
              radio_enabled bool default true)
play_events(id, owner_id, track_id, source, started_at, listened_s, completed bool, skipped bool,
            from_radio bool)
search_history(id, owner_id, query, source, created_at)
app_sessions(id, owner_id, started_at, last_seen_at)       -- tiempo de uso, alimentado por el heartbeat
radio_feedback(owner_id, artist, score)                     -- "No me gusta" penaliza
```

Vistas: `stats_top_tracks`, `stats_listening_time`, `stats_usage_time`, `stats_heatmap` (todas filtradas por `auth.uid()`).

Buckets: `media` (privado, ruta `{uid}/{trackId}.{ext}`), `covers`.

## Estructura de carpetas

```
src/
  app/(auth)/login, register
  app/(app)/library, playlists, queue, stats, settings/integrations
  components/floating-player   mini‑reproductor + Document PiP
  lib/radio/       recomendaciones (señales, candidatos, ranking)
  app/api/youtube/search, spotify/token, upload/sign, session/heartbeat
  lib/media/       extracción de audio (ffmpeg.wasm)
  components/player, queue, library, ui (kawaii)
  lib/ds/          estructuras de datos + tests
  lib/player/      PlayerEngine + sources
  lib/supabase/    clientes server/browser
  stores/          zustand
supabase/migrations/
```
