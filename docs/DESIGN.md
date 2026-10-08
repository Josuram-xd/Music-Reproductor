# Purrlist — Diseño "Pixel Neko"

Solo tema oscuro. Tierno pero no infantil: noche violeta, acentos pastel y **pixel art**: gatitos, huellitas, destellos y notas dibujados píxel a píxel. **Sin emojis** en la interfaz: todo lo decorativo son sprites propios.

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

- Títulos, botones y etiquetas: **Pixelify Sans** (pixel). Texto corrido: **Nunito**, para que se lea bien. Ambas de Google Fonts (`next/font`).

## Estilo pixel

- **Esquinas rectas**: todos los `rounded-*` valen 0 (tokens en `globals.css`).
- **Sombras duras** sin desenfoque: `shadow-pixel` (4 px), `shadow-pixel-sm` (2 px) y `shadow-pixel-primary` (botón principal). Los botones se "hunden" al pulsarlos (se mueven y pierden la sombra).
- Marcos de 2 px (`border-2 border-surface-2`) en modales, toasts y tarjetas elevadas.
- Fondo con estrellitas de 2 px repetidas (`--starfield`).
- Animaciones con `steps()` (a saltos, como un sprite), nunca suaves.

## Sprites (`src/components/ui/pixel`)

- Cada sprite es una cuadrícula de caracteres; cada carácter es un píxel de un color del tema (`PIXEL_PALETTE`). `PixelSprite` lo dibuja como SVG nítido (`shape-rendering: crispEdges`).
- Gatos: cara (logo), dormido (estados vacíos, con "z" flotando), triste (sesión caducada), corriendo tras un ovillo (cargando) y orejitas sobre "Ahora suena" y el mini‑reproductor.
- Decoración: huellita, corazón, destello que titila y nota musical. Iconos de los toasts: huellita (info), corazón (éxito), "!" (aviso) y "x" (error).
- Slider de progreso y volumen = pista pixel rellena hasta el valor (`--progress`) con thumb de **huellita pixel** (`.paw-slider`).
- Microcopy con tono neko ("¡Nya~! Canción añadida"), sin emojis.

## Accesibilidad

- Contraste AA (≥ 4,5:1) en todos los pares de texto/fondo; sin textos atenuados por opacidad.
- Foco visible siempre: anillo de los componentes o, si falta, contorno discontinuo menta.
- `prefers-reduced-motion`: sin animaciones ni transiciones.
- Táctil: cada botón tiene un área de toque de al menos 44 × 44 px (un `::after` invisible que no cambia el layout).
- Los sprites decorativos llevan `aria-hidden`; los que informan tienen nombre accesible. El mapa de calor tiene tabla alternativa.
- QA en Playwright en 3 tamaños (móvil 390 px, pantalla dividida 800 px, escritorio 1440 px).

## Layout responsive (por ancho de ventana, vía container queries)

- **≥ 1024 px** (navegador completo): sidebar (biblioteca/carpetas) · contenido · panel de cola a la derecha.
- **640–1024 px** (tablet / pantalla dividida): sidebar compacto de iconos · contenido · cola en panel desplegable.
- **< 640 px** (móvil / ventana estrecha): tabs abajo, cola como bottom sheet, "Ahora suena" a pantalla completa.
- Controles de reproducción: **mini‑reproductor flotante** (por defecto) o **barra fija abajo** (si el usuario quita el flotante).

## Mini‑reproductor flotante

- Tarjeta pixel (marco de 2 px y sombra dura) con orejitas pixel en la esquina, carátula, título, tiempo y anterior / reproducir / siguiente.
- 50 % de opacidad en reposo → 100 % con hover / foco / toque; `backdrop-filter: blur` para que se lea encima de cualquier fondo.
- En móvil se reduce a una "píldora" con carátula + ⏯ que se expande al tocarla.
- Asa de arrastre con huellita; botón de cerrar para ocultarlo; botón para sacarlo de la ventana (Document PiP).

## Estadísticas

- Tarjetas de KPI (tiempo escuchado, tiempo de uso, sesión actual, racha) con iconos de gato.
- Top canciones / artistas como lista con barras rosas; mapa de calor día × hora en la escala lavanda → rosa, con celdas cuadradas.
