import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { QueueButton, QueueDrawerProvider, useQueueDrawer } from "./queue-drawer";

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

const renderDrawer = () =>
  render(
    <QueueDrawerProvider panel={<p>Panel de la cola</p>}>
      <QueueButton variant="tab" />
      <QueueButton variant="header" />
    </QueueDrawerProvider>,
  );

const dialog = () => screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;

describe("QueueDrawer", () => {
  test("starts closed", () => {
    renderDrawer();
    expect(dialog().open).toBe(false);
    expect(screen.getByRole("button", { name: "Cola" })).toHaveAttribute("aria-expanded", "false");
  });

  test("both buttons open the same drawer", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Cola" }));
    expect(dialog().open).toBe(true);
    expect(screen.getByText("Panel de la cola")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir cola" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cerrar cola", hidden: true }));
    expect(dialog().open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Abrir cola" }));
    expect(dialog().open).toBe(true);
  });

  test("a click on the backdrop closes it, a click inside does not", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Cola" }));
    fireEvent.click(screen.getByText("Panel de la cola"));
    expect(dialog().open).toBe(true);
    fireEvent.click(dialog());
    expect(dialog().open).toBe(false);
  });

  test("Esc (native close) keeps the state in sync", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Cola" }));
    act(() => dialog().close());
    expect(screen.getByRole("button", { name: "Cola" })).toHaveAttribute("aria-expanded", "false");
  });

  test("closes when the window grows to desktop width", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Cola" }));
    act(() => {
      window.innerWidth = 1280;
      window.dispatchEvent(new Event("resize"));
    });
    expect(dialog().open).toBe(false);
  });

  test("useQueueDrawer requires the provider", () => {
    const Orphan = () => {
      useQueueDrawer();
      return null;
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/QueueDrawerProvider/);
    vi.restoreAllMocks();
  });
});
