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
- [x] Recuperar contraseña por correo y establecer una nueva con enlace de Supabase Auth
- [x] Middleware que protege `(app)`; rol `owner` asignado por SQL
- [x] Heartbeat `/api/session/heartbeat` + cookie firmada `pl_last_seen`
- [x] Middleware: logout si `now - last_seen > SESSION_GRACE_SECONDS` → `/login?reason=expired`
- [x] Overlay "Reconectando…" con cuenta atrás de la gracia + refresh al volver la red
- [x] Login con Google (OAuth de Supabase) + nombre y foto de Google en el perfil

## E3 · Motor de reproducción

- [x] App shell responsive (container queries: 3 columnas / iconos + panel / tabs + bottom sheet)
- [x] Interfaz `PlaybackSource` + `LocalAudioSource`
- [x] `PlayerEngine` sobre la cola (play, pause, next, seek ±10 s, volumen)
- [x] Doble back + toast de "primera canción"
- [x] Atajos de teclado y Media Session API

## E4 · Biblioteca, subidas y carpetas

- [x] Migraciones `folders`, `tracks`, buckets + RLS
- [x] Subida directa a Storage (signed URL, drag & drop de archivos del PC, barra de progreso)
- [x] Vídeo local → extraer audio con ffmpeg.wasm (carga diferida, `-c:a copy` con fallback a recodificar) y subir solo el audio
- [x] Lectura de metadatos (duración, ID3/carátula) en el cliente
- [x] Árbol de carpetas: crear, renombrar, mover (drag & drop), borrar
- [x] Búsqueda con Trie

## E5 · Cola y drag & drop

- [x] Panel de cola ordenable (dnd-kit), arrastrar desde biblioteca a cola
- [x] Modal de 3 opciones al soltar encima de la que suena (reproducir ahora / revertir / a continuación)
- [x] "No volver a preguntar en esta sesión" (sessionStorage) + toast "Deshacer" 5 s + reactivar en Ajustes
- [x] Botón "Añadir a la cola" en cada canción (alternativa al arrastre en móvil, tablet y teclado)
- [x] Undo/redo de la cola (Ctrl+Z)
- [x] Persistir `queue_state`

## E5.1 · Listas de reproducción

- [x] Migraciones `playlists` y `playlist_items` (rank fraccional / lexorank) + RLS
- [x] Utilidad de rank fraccional (entre dos ranks, inicio, fin, rebalanceo) + tests
- [x] Página Playlists: crear varias listas, renombrar, borrar (con confirmación)
- [x] Vista de una playlist: canciones ordenables con dnd-kit (solo se reescribe el rank movido)
- [x] Añadir canciones a una playlist desde la biblioteca (menú "Añadir a…" + arrastrar)
- [x] Quitar canciones de una playlist (sin borrarlas de la biblioteca)
- [x] Reproducir una playlist (reemplaza la cola) / añadirla entera a la cola
- [x] Carátula de la playlist (mosaico de las 4 primeras carátulas; subir una propia queda pendiente, la columna `cover_path` ya existe)
- [x] Guardar la cola actual como playlist

## E6 · YouTube

- [x] `/api/youtube/search` + cache en `yt_search_cache`
- [x] API key propia del usuario (cifrada) como prioridad / fallback al agotar la cuota compartida
- [x] `YouTubeSource` con IFrame Player API (vídeo visible en "Ahora suena")
- [x] Añadir resultados a cola/carpetas

## E7 · Spotify

- [x] Pantalla de integraciones: el usuario pega su Client ID (guía paso a paso)
- [x] OAuth PKCE + refresh tokens cifrados
- [x] `SpotifySource` con Web Playback SDK (aviso si no es Premium)
- [x] Búsqueda y añadir a cola

## E8 · Mini‑reproductor flotante

- [x] Migración `user_settings` (floating_player, floating_pos, radio_enabled)
- [x] Widget flotante: carátula, título, tiempo, progreso, ⏮ ⏯ ⏭
- [x] Opacidad 50 % ↔ 100 % (hover / foco / toque 4 s)
- [x] Arrastrar + pegar al borde + recordar posición; reajuste al redimensionar
- [x] Activar/desactivar (Ajustes + ✕) con fallback a barra fija
- [x] Document Picture‑in‑Picture ("Sacar de la ventana") con detección de soporte
- [x] Versión píldora en móvil

## E9 · Radio neko (recomendaciones)

- [x] Migraciones `play_events`, `search_history`, `radio_feedback`
- [x] Registrar eventos de reproducción (completada / saltada / tiempo escuchado)
- [x] Generador de candidatos (biblioteca → YouTube cacheado → Spotify search)
- [x] Puntuación + Max‑Heap + exclusión de lo reciente + tests
- [x] Auto‑rellenar la cola al quedar ≤ 1 canción; etiqueta 🐾, quitar y "No me gusta"
- [x] Toggle en Ajustes y en la cola

## E10 · Estadísticas

- [x] Migración `app_sessions` alimentada por el heartbeat + vistas `stats_*`
- [x] Página "Mis stats": KPIs (tiempo escuchado, uso, sesión actual en vivo, racha)
- [x] Top canciones / artistas / carpetas por periodo
- [x] Mapa de calor día × hora, más saltadas, tiempo por fuente
- [x] "Borrar mi historial"

## E11 · Diseño kawaii (pixel art)

- [x] Tokens, fuentes, componentes base (Button, Modal, Toast, Slider huellita)
- [x] Ilustraciones SVG de gatos (vacíos, carga, orejitas)
- [x] QA responsive (móvil, pantalla dividida, escritorio) con Playwright en 3 viewports
- [x] Accesibilidad (foco, contraste, reduced motion, táctil ≥ 44 px)

## E12 · Deploy

- [x] Variables de entorno en Vercel, dominio, redirect URIs de Spotify (runbook en `docs/DEPLOY.md`)
- [x] GitHub Actions: lint + typecheck + tests en PRs
- [ ] Protección de rama `main` en GitHub (pasos en `docs/DEPLOY.md` §6)
