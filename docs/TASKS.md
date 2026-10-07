# Purrlist — Tasks

Cada épica puede ser uno o varios commits (los hace el humano). `[ ]` pendiente.

## E0 · Setup

- [x] Next.js + TS strict + Tailwind + ESLint/Prettier
- [x] Script `prepare` que activa `.githooks` (se omite en CI/Vercel)
- [x] Vitest + Playwright configurados
- [x] Proyecto Supabase + variables en `.env.local` y Vercel
- [x] Proyecto en Vercel conectado al repo

## E1 · Estructuras de datos (`src/lib/ds`)

- [x] `DoublyLinkedList` (+ índice por id, move, insertAfter, toArray) + tests
- [x] Variante circular para repetir-todo + tests
- [x] `Stack` + `UndoManager` (Command pattern) + tests
- [x] `FolderTree` (árbol n-ario: add, move, remove, path) + tests
- [x] `Trie` para búsqueda + tests
- [x] `LRUCache` + tests
- [x] Shuffle Fisher‑Yates con semilla + tests
- [x] `PriorityQueue` (Max‑Heap) + tests

## E2 · Auth y roles

- [x] Migración `profiles` + trigger al registrarse
- [x] Login / registro / logout (Supabase Auth)
- [x] Middleware que protege `(app)`; rol `owner` asignado por SQL
- [x] Heartbeat `/api/session/heartbeat` + cookie firmada `pl_last_seen`
- [x] Middleware: logout si `now - last_seen > SESSION_GRACE_SECONDS` → `/login?reason=expired`
- [x] Overlay "Reconectando…" con cuenta atrás de la gracia + refresh al volver la red
- [x] Login con Google (OAuth de Supabase) + nombre y foto de Google en el perfil

## E3 · Motor de reproducción

- [x] App shell responsive (container queries: 3 columnas / iconos + panel / tabs + bottom sheet)
- [x] Interfaz `PlaybackSource` + `LocalAudioSource`
- [ ] `PlayerEngine` sobre la cola (play, pause, next, seek ±10 s, volumen)
- [ ] Doble back + toast de "primera canción"
- [ ] Atajos de teclado y Media Session API

## E4 · Biblioteca, subidas y carpetas

- [ ] Migraciones `folders`, `tracks`, buckets + RLS
- [ ] Subida directa a Storage (signed URL, drag & drop de archivos del PC, barra de progreso)
- [ ] Vídeo local → extraer audio con ffmpeg.wasm (carga diferida, `-c:a copy` con fallback a recodificar) y subir solo el audio
- [ ] Lectura de metadatos (duración, ID3/carátula) en el cliente
- [ ] Árbol de carpetas: crear, renombrar, mover (drag & drop), borrar
- [ ] Búsqueda con Trie

## E5 · Cola y drag & drop

- [ ] Panel de cola ordenable (dnd-kit), arrastrar desde biblioteca a cola
- [ ] Modal de 3 opciones al soltar encima de la que suena (reproducir ahora / revertir / a continuación)
- [ ] "No volver a preguntar en esta sesión" (sessionStorage) + toast "Deshacer" 5 s + reactivar en Ajustes
- [ ] Undo/redo de la cola (Ctrl+Z)
- [ ] Persistir `queue_state`
- [ ] Playlists con rank fraccional

## E6 · YouTube

- [ ] `/api/youtube/search` + cache en `yt_search_cache`
- [ ] API key propia del usuario (cifrada) como prioridad / fallback al agotar la cuota compartida
- [ ] `YouTubeSource` con IFrame Player API (vídeo visible en "Ahora suena")
- [ ] Añadir resultados a cola/carpetas

## E7 · Spotify

- [ ] Pantalla de integraciones: el usuario pega su Client ID (guía paso a paso)
- [ ] OAuth PKCE + refresh tokens cifrados
- [ ] `SpotifySource` con Web Playback SDK (aviso si no es Premium)
- [ ] Búsqueda y añadir a cola

## E8 · Mini‑reproductor flotante

- [ ] Migración `user_settings` (floating_player, floating_pos, radio_enabled)
- [ ] Widget flotante: carátula, título, tiempo, progreso, ⏮ ⏯ ⏭
- [ ] Opacidad 50 % ↔ 100 % (hover / foco / toque 4 s)
- [ ] Arrastrar + pegar al borde + recordar posición; reajuste al redimensionar
- [ ] Activar/desactivar (Ajustes + ✕) con fallback a barra fija
- [ ] Document Picture‑in‑Picture ("Sacar de la ventana") con detección de soporte
- [ ] Versión píldora en móvil

## E9 · Radio neko (recomendaciones)

- [ ] Migraciones `play_events`, `search_history`, `radio_feedback`
- [ ] Registrar eventos de reproducción (completada / saltada / tiempo escuchado)
- [ ] Generador de candidatos (biblioteca → YouTube cacheado → Spotify search)
- [ ] Puntuación + Max‑Heap + exclusión de lo reciente + tests
- [ ] Auto‑rellenar la cola al quedar ≤ 1 canción; etiqueta 🐾, quitar y "No me gusta"
- [ ] Toggle en Ajustes y en la cola

## E10 · Estadísticas

- [ ] Migración `app_sessions` alimentada por el heartbeat + vistas `stats_*`
- [ ] Página "Mis stats": KPIs (tiempo escuchado, uso, sesión actual en vivo, racha)
- [ ] Top canciones / artistas / carpetas por periodo
- [ ] Mapa de calor día × hora, más saltadas, tiempo por fuente
- [ ] "Borrar mi historial"

## E11 · Diseño kawaii

- [ ] Tokens, fuentes, componentes base (Button, Modal, Toast, Slider huellita)
- [ ] Ilustraciones SVG de gatos (vacíos, carga, orejitas)
- [ ] QA responsive (móvil, pantalla dividida, escritorio) con Playwright en 3 viewports
- [ ] Accesibilidad (foco, contraste, reduced motion, táctil ≥ 44 px)

## E12 · Deploy

- [ ] Variables de entorno en Vercel, dominio, redirect URIs de Spotify
- [ ] GitHub Actions: lint + typecheck + tests en PRs
- [ ] Protección de rama `main` en GitHub
