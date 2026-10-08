import type { ReactNode } from "react";
import { PixelPaw, PixelSparkle } from "./pixel/pixel";

/** Page title in the pixel font, with a paw and a sparkle as decoration. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1 px-4 pt-6 pb-2 @tablet:px-8">
      <h1 className="flex items-center gap-3 font-display text-3xl font-semibold">
        <PixelPaw className="w-5 shrink-0" />
        {title}
        <PixelSparkle className="w-3 shrink-0 self-start" />
      </h1>
      {children ? <p className="text-sm text-muted">{children}</p> : null}
    </header>
  );
}
