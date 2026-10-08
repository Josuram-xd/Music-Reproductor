import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SIGNED_OUT_PATH } from "@/lib/auth/routes";
import { useToastStore } from "@/stores/toast-store";
import { SignOutButton } from "./sign-out-button";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(async () => {}),
  hardNavigate: vi.fn(),
  pause: vi.fn(),
}));
vi.mock("@/app/(auth)/actions", () => ({ signOut: mocks.signOut }));
vi.mock("@/lib/browser/navigation", () => ({ hardNavigate: mocks.hardNavigate }));
vi.mock("@/stores/player-store", () => ({ player: { pause: mocks.pause } }));

beforeEach(() => {
  vi.clearAllMocks();
  useToastStore.setState({ toasts: [] });
});

describe("SignOutButton", () => {
  test("stops the music, signs out and reloads the whole page on /login", async () => {
    render(<SignOutButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    });
    expect(mocks.pause).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.hardNavigate).toHaveBeenCalledWith(SIGNED_OUT_PATH);
    expect(mocks.pause.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]!,
    );
  });

  test("if the server fails it stays and says so", async () => {
    mocks.signOut.mockRejectedValueOnce(new Error("offline"));
    render(<SignOutButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    });
    expect(mocks.hardNavigate).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]?.tone).toBe("error");
  });
});
