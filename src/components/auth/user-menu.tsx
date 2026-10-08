import { requireUser } from "@/lib/auth/dal";
import { SignOutButton } from "./sign-out-button";

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
      <SignOutButton />
    </div>
  );
}
