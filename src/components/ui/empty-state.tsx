import type { ReactNode } from "react";
import { SleepingCat } from "./sleeping-cat";

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <SleepingCat className="w-32" />
      <p className="font-display text-lg font-semibold">{title}</p>
      {children ? <div className="max-w-xs text-sm text-muted">{children}</div> : null}
    </div>
  );
}
