"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";
import { SIGNED_OUT_PATH } from "@/lib/auth/routes";
import { hardNavigate } from "@/lib/browser/navigation";
import { player } from "@/stores/player-store";
import { toast } from "@/stores/toast-store";

/**
 * "Cerrar sesión": stops the music, ends the session on the server and
 * reloads the whole page on /login. A client-side redirect would keep the
 * player, the queue and the YouTube video of this user alive in memory.
 */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  const signOutNow = () => {
    startTransition(async () => {
      player.pause();
      try {
        await signOut();
      } catch {
        toast("No se pudo cerrar la sesión. Inténtalo otra vez", { tone: "error" });
        return;
      }
      hardNavigate(SIGNED_OUT_PATH);
    });
  };

  return (
    <button
      type="button"
      onClick={signOutNow}
      disabled={pending}
      aria-busy={pending || undefined}
      title="Cerrar sesión"
      className="flex h-11 items-center gap-2 px-3 text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
    >
      <LogOut aria-hidden className="size-5" />
      <span className="sr-only @desktop:not-sr-only">
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </span>
    </button>
  );
}
