# Reglas para agentes de IA (Claude, Cursor, Codex, Copilot, Gemini…)

## Git — PROHIBIDO
- **No** hacer `git commit`, `git push`, merges ni crear/mergear PRs. El humano commitea.
- **Nunca** añadir `Co-authored-by`, "Generated with…" ni firmas de IA en mensajes o PRs.
- **No** tocar `.githooks/`, `core.hooksPath` ni usar `--no-verify`.
- Si te piden un commit: deja los cambios en el working tree y sugiere un mensaje (Conventional Commits) como texto.

## Sugerir commit — OBLIGATORIO
Al terminar cada task/épica (o cuando el humano lo pida), cierra tu respuesta con un bloque así:

```
git add <archivos>
git commit -m "<tipo>(<ámbito>): <resumen en español, imperativo, ≤ 72 car.>" -m "<detalle opcional: qué y por qué>"
```
- Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`, `perf`.
- Ámbitos sugeridos: `ds`, `auth`, `player`, `library`, `queue`, `youtube`, `spotify`, `ui`, `deploy`, `repo`.
- Si se cerraron tasks de `docs/TASKS.md`, márcalas `[x]` e inclúyelo en el commit.
- Si los cambios son de temas muy distintos, sugiere varios commits separados.
- Sin `Co-authored-by` ni firmas de IA.

## Proyecto
App: **Purrlist** — reproductor musical kawaii neko (tema oscuro). Ver `docs/ARCHITECTURE.md`, `docs/DESIGN.md` y `docs/TASKS.md`.

- Next.js (App Router) + TypeScript estricto, desplegado en Vercel.
- Supabase: Auth, Postgres (con RLS), Storage.
- Estructuras de datos propias en `src/lib/ds/` con tests en Vitest. No sustituirlas por librerías.
- UI en español, con tono neko ("nya~") pero claro.
