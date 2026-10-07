"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, NAV_ITEMS } from "./nav-items";

type Variant = "sidebar" | "tab";

const STYLES: Record<Variant, { link: string; label: string }> = {
  // Icons only on tablet, icon + label on desktop.
  sidebar: {
    link: "flex h-11 items-center justify-center gap-3 rounded-2xl text-muted transition hover:bg-surface-2 hover:text-text aria-[current=page]:bg-primary/15 aria-[current=page]:text-primary @desktop:justify-start @desktop:px-4",
    label: "sr-only @desktop:not-sr-only",
  },
  // Bottom tab bar on mobile.
  tab: {
    link: "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold text-muted transition aria-[current=page]:text-primary",
    label: "",
  },
};

/** Takes only the `href`: icons are components, which cannot be passed from the server. */
export function NavLink({ href, variant }: { href: string; variant: Variant }) {
  const pathname = usePathname();
  const item = NAV_ITEMS.find((candidate) => candidate.href === href);
  if (!item) throw new Error(`Unknown nav item "${href}"`);
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;
  const styles = STYLES[variant];

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={variant === "sidebar" ? item.label : undefined}
      className={`focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none ${styles.link}`}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className={styles.label}>{item.label}</span>
    </Link>
  );
}
