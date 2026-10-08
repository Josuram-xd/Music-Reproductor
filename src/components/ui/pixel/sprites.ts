/**
 * Pixel-art sprites as rows of characters: each character is one pixel and
 * maps to a color of the palette ("." = transparent). Short rows are padded
 * with transparent pixels.
 */
export type Sprite = readonly string[];
export type Palette = Readonly<Record<string, string>>;

/** Theme colors (CSS variables, so sprites follow the tokens). */
export const PIXEL_PALETTE: Palette = {
  k: "var(--bg)", // outline
  f: "var(--secondary)", // fur
  d: "var(--surface-2)", // dark fur / shadow
  p: "var(--primary)", // pink: inner ears, nose, paws, hearts
  b: "color-mix(in oklab, var(--primary) 70%, var(--secondary))", // blush
  e: "var(--bg)", // eyes
  w: "var(--text)", // highlights
  s: "var(--accent)", // sparkles
  c: "var(--accent)", // tears
  y: "var(--primary)", // yarn
  l: "var(--secondary)", // yarn thread
  n: "var(--secondary)", // music notes
  o: "var(--warn)", // warning
  r: "var(--danger)", // error
};

/** Cat face, the logo (16 × 12). */
export const CAT_HEAD: Sprite = [
  ".kk..........kk.",
  ".kfk........kfk.",
  ".kpfk......kfpk.",
  ".kppfkkkkkkfppk.",
  "kffffffffffffffk",
  "kffffffffffffffk",
  "kfffeeffffeefffk",
  "kfffewffffewfffk",
  "kfbbfffppfffbbfk",
  "kfffffkffkfffffk",
  ".kffffffffffffk.",
  "..kkkkkkkkkkkk..",
];

/** Same face, eyes closed (sleepy / happy). */
export const CAT_HEAD_SLEEPY: Sprite = [
  ...CAT_HEAD.slice(0, 6),
  "kffffffffffffffk",
  "kfffkkffffkkfffk",
  ...CAT_HEAD.slice(8),
];

/** Same face, sad, with tears (session expired). */
export const CAT_HEAD_SAD: Sprite = [
  ...CAT_HEAD.slice(0, 6),
  "kfffeeffffeefffk",
  "kfffeeffffeefffk",
  "kfbcfffppfffcbfk",
  "kffffffkkffffffk",
  ...CAT_HEAD.slice(10),
];

/** Curled-up sleeping cat for empty states (24 × 12). */
export const CAT_SLEEPING: Sprite = [
  ".k....k",
  ".kk..kk",
  ".kpkkpk.....kkkkkkkk",
  ".kffffk...kkffffffffkk",
  "kffffffk.kffffffffffffk",
  "kfkkfkkfkfffffffffffffk",
  "kbfffffbkfffffdfffffffk",
  "kffffffffffffffdffffffkk",
  ".kfffffffffffffffffffkffk",
  "..kffffffffffffffffffkffk",
  "...kkkkkkkkkkkkkkkkkkffk",
  "....................kkk",
];

/** Running cat, two frames, for the loading animation (16 × 10). */
export const CAT_RUN: readonly Sprite[] = [
  [
    "..........k...k",
    "..........kk.kk",
    "..........kfffk",
    "...........kfefk",
    "k.kkkkkkkkkfffpk",
    "kkfffffffffffkk",
    ".kffffffffffffk",
    "..kffkkkkkffk",
    "..kfk.....kfk",
    "..kk.......kk",
  ],
  [
    "..........k...k",
    "..........kk.kk",
    "..........kfffk",
    "...........kfefk",
    "..kkkkkkkkkfffpk",
    "kkfffffffffffkk",
    "k.kffffffffffk",
    "...kffkkkffk",
    "....kfk.kfk",
    "....kk...kk",
  ],
];

/** Ball of yarn (8 × 8). */
export const YARN: Sprite = [
  "..yyyy",
  ".yylyyy",
  "yyyylyyy",
  "ylyyylyy",
  "yylyyyly",
  "yyylyyyy",
  ".yyyyly",
  "..yyyy",
];

/** Paw print (9 × 8). */
export const PAW: Sprite = [
  "..pp.pp",
  "..pp.pp",
  "pp.....pp",
  "pp.ppp.pp",
  "..ppppp",
  ".ppppppp",
  ".ppppppp",
  "..pp.pp",
];

/** Heart (7 × 6). */
export const HEART: Sprite = [".pp.pp", "ppppppp", "ppppppp", ".ppppp", "..ppp", "...p"];

/** Four-point sparkle (5 × 5). */
export const SPARKLE: Sprite = ["..s", "..s", "sswss", "..s", "..s"];

/** Music note (5 × 8). */
export const NOTE: Sprite = ["..nn", "..n.n", "..n", "..n", "..n", "nnn", "nnn", ".n"];

/** Exclamation in a block (warning toasts, 5 × 7). */
export const BANG: Sprite = ["ooooo", "oo.oo", "oo.oo", "oo.oo", "ooooo", "oo.oo", "ooooo"];

/** Cross in a block (error toasts, 5 × 5). */
export const CROSS: Sprite = ["r...r", ".r.r", "..r", ".r.r", "r...r"];

/** One cat ear (5 × 4), for the "Ahora suena" card and the mini-player. */
export const EAR: Sprite = ["..k", ".kpk", "kpppk", "kpppk"];

/** "z", for the sleeping cat (3 × 3). */
export const ZED: Sprite = ["nnn", ".n", "nnn"];

/** Horizontal runs of one color per row: what the SVG draws (fewer nodes than pixels). */
export function spriteRuns(
  sprite: Sprite,
  palette: Palette,
): { width: number; height: number; runs: { x: number; y: number; w: number; fill: string }[] } {
  const width = Math.max(0, ...sprite.map((row) => row.length));
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  sprite.forEach((row, y) => {
    let x = 0;
    while (x < width) {
      const char = row[x] ?? ".";
      const fill = palette[char];
      if (char === "." || !fill) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < width && row[end] === char) end++;
      runs.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return { width, height: sprite.length, runs };
}
