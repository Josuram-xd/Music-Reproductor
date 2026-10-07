import { ChartColumn, Library, ListMusic, type LucideIcon, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  /** Visible label (Spanish UI). */
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/library", label: "Biblioteca", icon: Library },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
  { href: "/stats", label: "Mis stats", icon: ChartColumn },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

/** Whether `href` is the current section (also matches nested pages). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
