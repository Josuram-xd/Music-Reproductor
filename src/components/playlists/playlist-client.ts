import { addToPlaylist, createPlaylist } from "@/lib/playlists/actions";
import { PLAYLIST_MESSAGES, playlistErrorMessage } from "@/lib/playlists/messages";
import type { PlaylistName } from "@/lib/playlists/playlists";
import { toast } from "@/stores/toast-store";

/** Adds tracks to a playlist from anywhere in the app and tells the user how it went. */
export async function addTracksToPlaylist(
  playlist: PlaylistName,
  trackIds: string[],
): Promise<boolean> {
  const result = await addToPlaylist(playlist.id, trackIds);
  if (!result.ok) {
    toast(playlistErrorMessage(result.error), { tone: "error" });
    return false;
  }
  const added = result.added ?? 0;
  toast(PLAYLIST_MESSAGES.added(added, playlist.name), {
    tone: added > 0 ? "success" : "info",
    durationMs: 2500,
  });
  return true;
}

/** Creates a playlist already holding `trackIds`; `message` is the success toast. */
export async function createPlaylistWith(
  name: string,
  trackIds: string[],
  message = PLAYLIST_MESSAGES.created(name),
): Promise<boolean> {
  const result = await createPlaylist(crypto.randomUUID(), name, trackIds);
  if (!result.ok) {
    toast(playlistErrorMessage(result.error), { tone: "error" });
    return false;
  }
  toast(message, { tone: "success", durationMs: 2500 });
  return true;
}
