import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { Command } from "@/lib/ds/undo-manager";
import { queue, useQueueStore } from "@/stores/queue-store";
import { DropChoiceDialog } from "./drop-choice-dialog";

vi.mock("@/stores/player-store", async () => {
  const { create } = await import("zustand");
  return { usePlayerStore: create(() => ({ current: { title: "Canción actual" } })) };
});

// jsdom does not implement the modal dialog API.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

const provisional: Command = { execute: vi.fn(), undo: vi.fn() };
const openDialog = () =>
  act(() =>
    useQueueStore.setState({
      pendingDrop: { track: { id: "x", source: "audio", title: "La nueva" }, provisional },
    }),
  );

beforeEach(() => {
  vi.restoreAllMocks();
  useQueueStore.setState({ pendingDrop: null, dropPreference: null });
});

describe("DropChoiceDialog", () => {
  test("opens with the three options and the warning names the cut track", () => {
    render(<DropChoiceDialog />);
    openDialog();
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(screen.getByText("La nueva")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reproducir ahora/ })).toHaveTextContent(
      "Se corta «Canción actual»",
    );
    expect(screen.getByRole("button", { name: /Ponerla a continuación/ })).toBeInTheDocument();
  });

  test("each button resolves the drop, passing the checkbox", () => {
    const resolve = vi.spyOn(queue, "resolveDrop").mockImplementation(() => {});
    render(<DropChoiceDialog />);
    openDialog();
    fireEvent.click(screen.getByRole("checkbox", { name: /No volver a preguntar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ponerla a continuación/ }));
    expect(resolve).toHaveBeenCalledWith("playNext", { remember: true });
  });

  test("closing it (Esc) counts as a mistake", () => {
    const resolve = vi.spyOn(queue, "resolveDrop").mockImplementation(() => {});
    render(<DropChoiceDialog />);
    openDialog();
    fireEvent(screen.getByRole("dialog"), new Event("close"));
    expect(resolve).toHaveBeenCalledWith("revert");
  });

  test("a click on the backdrop counts as a mistake", () => {
    const resolve = vi.spyOn(queue, "resolveDrop").mockImplementation(() => {});
    render(<DropChoiceDialog />);
    openDialog();
    fireEvent.click(screen.getByRole("dialog"));
    expect(resolve).toHaveBeenCalledWith("revert");
  });
});
