"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
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

/**
 * Takes only the `href`: icons are components, which cannot be passed from the server.
 * The pathname is request-time data on pages with dynamic params (e.g. /playlists/[id]),
 * so the active state streams in behind Suspense; the fallback is the inactive link.
 */
export function NavLink(props: { href: string; variant: Variant }) {
  return (
    <Suspense fallback={<NavLinkView {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink(props: { href: string; variant: Variant }) {
  const pathname = usePathname();
  return <NavLinkView {...props} active={isActivePath(pathname, props.href)} />;
}

function NavLinkView({
  href,
  variant,
  active,
}: {
  href: string;
  variant: Variant;
  active: boolean;
}) {
  const item = NAV_ITEMS.find((candidate) => candidate.href === href);
  if (!item) throw new Error(`Unknown nav item "${href}"`);
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
