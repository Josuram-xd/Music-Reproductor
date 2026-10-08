import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { progressStyle } from "@/lib/player/progress";
import { LoadingCat, PixelCat, PixelPaw, PixelSprite } from "./pixel";
import * as sprites from "./sprites";

const ALL: [string, sprites.Sprite][] = [
  ["CAT_HEAD", sprites.CAT_HEAD],
  ["CAT_HEAD_SLEEPY", sprites.CAT_HEAD_SLEEPY],
  ["CAT_HEAD_SAD", sprites.CAT_HEAD_SAD],
  ["CAT_SLEEPING", sprites.CAT_SLEEPING],
  ["CAT_RUN[0]", sprites.CAT_RUN[0]!],
  ["CAT_RUN[1]", sprites.CAT_RUN[1]!],
  ["YARN", sprites.YARN],
  ["PAW", sprites.PAW],
  ["HEART", sprites.HEART],
  ["SPARKLE", sprites.SPARKLE],
  ["NOTE", sprites.NOTE],
  ["BANG", sprites.BANG],
  ["CROSS", sprites.CROSS],
  ["EAR", sprites.EAR],
  ["ZED", sprites.ZED],
];

describe("sprites", () => {
  test.each(ALL)("%s only uses palette colors", (_, sprite) => {
    const keys = new Set(Object.keys(sprites.PIXEL_PALETTE));
    for (const row of sprite) {
      for (const char of row) expect(char === "." || keys.has(char)).toBe(true);
    }
  });

  test("the cat faces are 16 × 12 and symmetric", () => {
    for (const face of [sprites.CAT_HEAD, sprites.CAT_HEAD_SLEEPY, sprites.CAT_HEAD_SAD]) {
      expect(face).toHaveLength(12);
      for (const row of face) {
        expect(row).toHaveLength(16);
        // Mirror image, ignoring the highlight in the eyes.
        expect(row.replace(/w/g, "e")).toBe([...row].reverse().join("").replace(/w/g, "e"));
      }
    }
  });

  test("runs merge same-colored neighbours and skip transparent pixels", () => {
    const { width, height, runs } = sprites.spriteRuns(["ppk.", "..p"], { p: "pink", k: "black" });
    expect({ width, height }).toEqual({ width: 4, height: 2 });
    expect(runs).toEqual([
      { x: 0, y: 0, w: 2, fill: "pink" },
      { x: 2, y: 0, w: 1, fill: "black" },
      { x: 2, y: 1, w: 1, fill: "pink" },
    ]);
  });
});

describe("pixel components", () => {
  test("sprites are crisp SVGs, decorative unless titled", () => {
    const { container } = render(<PixelSprite sprite={["pp"]} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("shape-rendering", "crispEdges");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 2 1");

    render(<PixelCat title="Gato de Purrlist" />);
    expect(screen.getByRole("img", { name: "Gato de Purrlist" })).toBeInTheDocument();
  });

  test("decorations can be recoloured", () => {
    const { container } = render(<PixelPaw color="var(--accent)" />);
    expect(container.querySelector("rect")).toHaveAttribute("fill", "var(--accent)");
  });

  test("the loading cat announces what is loading", () => {
    render(<LoadingCat label="Buscando…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Buscando…");
  });
});

describe("progressStyle", () => {
  test("fills the paw slider track proportionally, clamped", () => {
    expect(progressStyle(30, 120)).toEqual({ "--progress": "25%" });
    expect(progressStyle(500, 120)).toEqual({ "--progress": "100%" });
    expect(progressStyle(5, 0)).toEqual({ "--progress": "0%" });
  });
});
