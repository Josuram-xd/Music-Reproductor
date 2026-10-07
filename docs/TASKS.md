# Purrlist — Tasks

Cada épica puede ser uno o varios commits (los hace el humano). `[ ]` pendiente.

## E0 · Setup
- [ ] Next.js + TS strict + Tailwind + ESLint/Prettier
- [ ] `"prepare": "git config core.hooksPath .githooks"` en package.json
- [ ] Vitest + Playwright configurados
- [ ] Proyecto Supabase + variables en `.env.local` y Vercel
- [ ] Proyecto en Vercel conectado al repo

## E1 · Estructuras de datos (`src/lib/ds`)
- [ ] `DoublyLinkedList` (+ índice por id, move, insertAfter, toArray) + tests
- [ ] Variante circular para repetir-todo + tests
- [ ] `Stack` + `UndoManager` (Command pattern) + tests
- [ ] `FolderTree` (árbol n-ario: add, move, remove, path) + tests
- [ ] `Trie` para búsqueda + tests
- [ ] `LRUCache` + tests
- [ ] Shuffle Fisher‑Yates con semilla + tests

## E2 · Auth y roles
- [ ] Migración `profiles` + trigger al registrarse
- [ ] Login / registro / logout (Supabase Auth)
- [ ] Middleware que protege `(app)`; rol `owner` asignado por SQL
- [ ] Heartbeat `/api/session/heartbeat` + cookie firmada `pl_last_seen`
- [ ] Middleware: logout si `now - last_seen > SESSION_GRACE_SECONDS` → `/login?reason=expired`
- [ ] Overlay "Reconectando…" con cuenta atrás de la gracia + refresh al volver la red

## E3 · Motor de reproducción
- [ ] Interfaz `PlaybackSource` + `LocalAudioSource`
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

## E8 · Diseño kawaii
- [ ] Tokens, fuentes, componentes base (Button, Modal, Toast, Slider huellita)
- [ ] Ilustraciones SVG de gatos (vacíos, carga, orejitas)
- [ ] Responsive móvil + accesibilidad (foco, contraste, reduced motion)

## E9 · Deploy
- [ ] Variables de entorno en Vercel, dominio, redirect URIs de Spotify
- [ ] GitHub Actions: lint + typecheck + tests en PRs
- [ ] Protección de rama `main` en GitHub
