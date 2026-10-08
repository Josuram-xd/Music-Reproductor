import type { ReactNode } from "react";
import { PixelNote, PixelSparkle, SleepingCat } from "./pixel/pixel";

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
}

/** Sleeping pixel cat, a couple of notes and sparkles around it, and the message. */
export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div aria-hidden className="relative">
        <SleepingCat className="w-36" />
        <PixelNote className="absolute -top-4 -left-6 w-3 opacity-70" />
        <PixelSparkle className="absolute top-2 -right-4 w-2.5" delay={300} />
        <PixelSparkle className="absolute -bottom-1 -left-3 w-2" delay={900} />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {children ? <div className="max-w-xs text-sm text-muted">{children}</div> : null}
    </div>
  );
}
