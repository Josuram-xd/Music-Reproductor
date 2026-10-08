import type { CSSProperties } from "react";
import {
  CAT_HEAD,
  CAT_HEAD_SAD,
  CAT_HEAD_SLEEPY,
  CAT_RUN,
  CAT_SLEEPING,
  EAR,
  HEART,
  NOTE,
  PAW,
  type Palette,
  PIXEL_PALETTE,
  SPARKLE,
  type Sprite,
  spriteRuns,
  YARN,
  ZED,
} from "./sprites";

interface PixelSpriteProps {
  sprite: Sprite;
  palette?: Palette;
  className?: string;
  style?: CSSProperties;
  /** Accessible name; without it the sprite is decorative. */
  title?: string;
}

/** Draws a sprite as crisp SVG pixels (scales without blurring). */
export function PixelSprite({
  sprite,
  palette = PIXEL_PALETTE,
  className = "",
  style,
  title,
}: PixelSpriteProps) {
  const { width, height, runs } = spriteRuns(sprite, palette);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={className}
      style={style}
    >
      {runs.map((run) => (
        <rect
          key={`${run.x}-${run.y}`}
          x={run.x}
          y={run.y}
          width={run.w}
          height={1}
          fill={run.fill}
        />
      ))}
    </svg>
  );
}

export type CatMood = "happy" | "sleepy" | "sad";
const HEADS: Record<CatMood, Sprite> = {
  happy: CAT_HEAD,
  sleepy: CAT_HEAD_SLEEPY,
  sad: CAT_HEAD_SAD,
};

/** The Purrlist cat face (logo, overlays). */
export function PixelCat({
  mood = "happy",
  className = "",
  title,
}: {
  mood?: CatMood;
  className?: string;
  title?: string;
}) {
  return <PixelSprite sprite={HEADS[mood]} className={className} title={title} />;
}

/** Tiny decorations, recoloured with `color` (a CSS color) when given. */
function tinted(sprite: Sprite, key: string, color?: string): [Sprite, Palette] {
  return [sprite, color ? { ...PIXEL_PALETTE, [key]: color } : PIXEL_PALETTE];
}

export function PixelPaw({ className = "", color }: { className?: string; color?: string }) {
  const [sprite, palette] = tinted(PAW, "p", color);
  return <PixelSprite sprite={sprite} palette={palette} className={className} />;
}

export function PixelHeart({ className = "", color }: { className?: string; color?: string }) {
  const [sprite, palette] = tinted(HEART, "p", color);
  return <PixelSprite sprite={sprite} palette={palette} className={className} />;
}

export function PixelNote({ className = "", color }: { className?: string; color?: string }) {
  const [sprite, palette] = tinted(NOTE, "n", color);
  return <PixelSprite sprite={sprite} palette={palette} className={className} />;
}

/** A twinkling sparkle (still with reduced motion). */
export function PixelSparkle({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <PixelSprite
      sprite={SPARKLE}
      className={`motion-safe:animate-twinkle ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

/** Two pixel cat ears sticking out of the top edge of a card. */
export function PixelEars({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none flex gap-6 ${className}`}>
      <PixelSprite sprite={EAR} className="w-4" />
      <PixelSprite sprite={EAR} className="w-4" />
    </span>
  );
}

/** Curled-up cat with floating "z"s, for empty states. */
export function SleepingCat({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`relative inline-block ${className}`}>
      <PixelSprite sprite={CAT_SLEEPING} className="w-full" />
      <PixelSprite
        sprite={ZED}
        className="absolute -top-1 right-[18%] w-[9%] motion-safe:animate-float-z"
      />
      <PixelSprite
        sprite={ZED}
        className="absolute -top-5 right-[6%] w-[6%] motion-safe:animate-float-z"
        style={{ animationDelay: "700ms" }}
      />
    </span>
  );
}

/** A cat running after a ball of yarn: the loading state. */
export function LoadingCat({
  label = "Cargando…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" className={`flex flex-col items-center gap-3 py-8 ${className}`}>
      <div aria-hidden className="relative h-10 w-48 overflow-hidden">
        <div className="absolute bottom-0 left-0 flex items-end gap-3 motion-safe:animate-chase">
          <span className="relative block h-9 w-14">
            <PixelSprite
              sprite={CAT_RUN[0]!}
              className="absolute inset-0 motion-safe:animate-frame-a"
            />
            <PixelSprite
              sprite={CAT_RUN[1]!}
              className="absolute inset-0 opacity-0 motion-safe:animate-frame-b"
            />
          </span>
          <PixelSprite sprite={YARN} className="w-5 motion-safe:animate-roll" />
        </div>
      </div>
      <p className="font-display text-sm text-muted">{label}</p>
    </div>
  );
}
