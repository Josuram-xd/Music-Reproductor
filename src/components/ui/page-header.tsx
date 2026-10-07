import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1 px-4 pt-6 pb-2 @tablet:px-8">
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      {children ? <p className="text-sm text-muted">{children}</p> : null}
    </header>
  );
}
