import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";

export async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted sm:inline">
        {user.username ?? user.email}
        {user.role === "owner" ? (
          <span className="ml-2 rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-semibold text-secondary">
            owner
          </span>
        ) : null}
      </span>
      <form action={signOut}>
        <Button type="submit" variant="ghost">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
