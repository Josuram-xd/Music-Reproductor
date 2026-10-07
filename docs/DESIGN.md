# Purrlist — Diseño "Dark Kawaii Neko"

Solo tema oscuro. Tierno pero no infantil: noche violeta, acentos pastel, detalles de gato pequeños.

## Paleta (tokens CSS)

| Token                | Hex                   | Uso                                                    |
| -------------------- | --------------------- | ------------------------------------------------------ |
| `--bg`               | `#14111F`             | Fondo (noche)                                          |
| `--surface`          | `#1E1A2E`             | Tarjetas, sidebar                                      |
| `--surface-2`        | `#2A2440`             | Hover, inputs                                          |
| `--primary`          | `#FF8FC7`             | Rosa sakura — acción principal, progreso               |
| `--secondary`        | `#B69CFF`             | Lavanda — selección, foco                              |
| `--accent`           | `#8EF0D0`             | Menta — éxito, "ahora suena"                           |
| `--warn`             | `#FFB38A`             | Durazno — avisos (modal de reemplazo, primera canción) |
| `--danger`           | `#FF6B8B`             | Borrar                                                 |
| `--text` / `--muted` | `#F5ECFF` / `#A79CC2` | Texto                                                  |

## Tipografía

- Títulos: **Fredoka** (redondeada). Texto: **Nunito**. Ambas de Google Fonts.

## Motivos neko

- Orejitas de gato sobre la carátula de "Ahora suena"; parpadean al pausar.
- Thumb de la barra de progreso = huellita 🐾; la barra es la "cola" del gato.
- Estados vacíos con gato dormido (SVG); al cargar, gato persiguiendo un ovillo.
- Toasts con microcopy: "¡Nya~! Canción añadida", "Es la primera canción, no hay vuelta atrás 🐾".
- Bordes muy redondeados (16–24 px), sombras con glow rosa suave.
- `prefers-reduced-motion` desactiva animaciones.

## Layout

- Escritorio: sidebar (biblioteca/carpetas) · contenido · panel de cola a la derecha · reproductor fijo abajo.
- Móvil: tabs abajo, mini‑player que se expande a pantalla completa.
