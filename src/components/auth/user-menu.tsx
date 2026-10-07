import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { requireUser } from "@/lib/auth/dal";

export async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted @tablet:inline">
        {user.username ?? user.email}
        {user.role === "owner" ? (
          <span className="ml-2 rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-semibold text-secondary">
            owner
          </span>
        ) : null}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          title="Cerrar sesión"
          className="flex h-11 items-center gap-2 rounded-2xl px-3 text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
        >
          <LogOut aria-hidden className="size-5" />
          <span className="sr-only @desktop:not-sr-only">Cerrar sesión</span>
        </button>
      </form>
    </div>
  );
}
