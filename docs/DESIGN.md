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

## Layout responsive (por ancho de ventana, vía container queries)

- **≥ 1024 px** (navegador completo): sidebar (biblioteca/carpetas) · contenido · panel de cola a la derecha.
- **640–1024 px** (tablet / pantalla dividida): sidebar compacto de iconos · contenido · cola en panel desplegable.
- **< 640 px** (móvil / ventana estrecha): tabs abajo, cola como bottom sheet, "Ahora suena" a pantalla completa.
- Controles de reproducción: **mini‑reproductor flotante** (por defecto) o **barra fija abajo** (si el usuario quita el flotante).

## Mini‑reproductor flotante

- Tarjeta redondeada (radio 20 px) con orejitas de gato en la esquina, carátula, título, tiempo y ⏮ ⏯ ⏭.
- 50 % de opacidad en reposo → 100 % con hover / foco / toque; `backdrop-filter: blur` para que se lea encima de cualquier fondo.
- En móvil se reduce a una "píldora" con carátula + ⏯ que se expande al tocarla.
- Asa de arrastre con huellita; ✕ para ocultarlo; ⧉ para sacarlo de la ventana (Document PiP).

## Estadísticas

- Tarjetas de KPI (tiempo escuchado, tiempo de uso, sesión actual, racha) con iconos de gato.
- Top canciones / artistas como lista con barras rosas; mapa de calor día × hora en la escala lavanda → rosa.
