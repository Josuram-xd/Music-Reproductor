import { ListMusic } from "lucide-react";

/**
 * Playlist cover: a mosaic of its first track covers (1 → full, 2–4 → 2×2),
 * or a kawaii placeholder when none has a cover.
 */
export function PlaylistCover({
  covers,
  className = "",
}: {
  covers: string[];
  className?: string;
}) {
  const shown = covers.slice(0, 4);
  return (
    <div
      aria-hidden
      className={`relative aspect-square overflow-hidden rounded-2xl bg-linear-to-br from-primary/30 via-surface-2 to-secondary/30 ${className}`}
    >
      {shown.length === 0 ? (
        <span className="flex size-full items-center justify-center text-primary">
          <ListMusic className="size-1/3" />
        </span>
      ) : shown.length === 1 ? (
        // Signed URLs of a private bucket: next/image would need its domain configured.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown[0]} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <div className="grid size-full grid-cols-2 grid-rows-2">
          {[0, 1, 2, 3].map((i) =>
            shown[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={shown[i]}
                alt=""
                className="size-full object-cover"
                draggable={false}
              />
            ) : (
              <span key={i} className="bg-surface-2" />
            ),
          )}
        </div>
      )}
    </div>
  );
}
