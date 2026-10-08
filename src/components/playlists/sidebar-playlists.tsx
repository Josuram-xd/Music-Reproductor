"use client";

import { ListMusic } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { useDropTarget } from "@/components/library/dnd";
import { isId, type PlaylistName } from "@/lib/playlists/playlists";
import { addTracksToPlaylist } from "./playlist-client";

/** Desktop sidebar list of playlists; library tracks can be dropped on them. */
export function SidebarPlaylists({ playlists }: { playlists: PlaylistName[] }) {
  if (playlists.length === 0) {
    return (
      <p className="text-sm text-muted/80">Crea una en «Playlists» y arrastra canciones aquí 🐾</p>
    );
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {playlists.map((playlist) => (
        <SidebarPlaylist key={playlist.id} playlist={playlist} />
      ))}
    </ul>
  );
}

// Rendered inside the layout's <Suspense>, so reading the pathname is fine on dynamic routes.
function SidebarPlaylist({ playlist }: { playlist: PlaylistName }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const href = `/playlists/${playlist.id}`;
  const drop = useDropTarget(
    (item) => startTransition(async () => void (await addTracksToPlaylist(playlist, [item.id]))),
    // YouTube results that are not saved in the library have no uuid yet.
    (item) => item.kind === "track" && isId(item.id),
  );

  return (
    <li {...drop.props}>
      <Link
        href={href}
        aria-current={pathname === href ? "page" : undefined}
        aria-busy={pending || undefined}
        className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary ${
          drop.over ? "bg-primary/15 text-primary ring-2 ring-primary" : ""
        }`}
      >
        <ListMusic aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{playlist.name}</span>
      </Link>
    </li>
  );
}
