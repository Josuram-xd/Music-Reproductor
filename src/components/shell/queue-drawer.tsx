"use client";

import { ListOrdered, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Width (px) from which the queue is a fixed column and the drawer is not needed. */
const DESKTOP_MIN_WIDTH = 1024;

interface QueueDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const QueueDrawerContext = createContext<QueueDrawerState | null>(null);

export function useQueueDrawer(): QueueDrawerState {
  const state = useContext(QueueDrawerContext);
  if (!state) throw new Error("useQueueDrawer must be used inside <QueueDrawerProvider>");
  return state;
}

/**
 * Holds the queue drawer: a bottom sheet on mobile and a side panel on
 * tablet, built on a native modal `<dialog>` (focus trap, Esc, inert page).
 * On desktop the queue is a fixed column instead, so the drawer closes.
 */
export function QueueDrawerProvider({
  panel,
  children,
}: {
  panel: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      if (window.innerWidth >= DESKTOP_MIN_WIDTH) close();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, close]);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <QueueDrawerContext value={value}>
      {children}
      <dialog
        ref={dialogRef}
        aria-label="Cola de reproducción"
        // Esc fires "close" on the native dialog: keep React state in sync.
        onClose={close}
        // A click on the dialog box itself (not its content) is a click on the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-3xl bg-surface p-0 text-text shadow-[0_0_40px_-12px_var(--primary)] transition-transform duration-300 backdrop:bg-bg/60 backdrop:backdrop-blur-sm motion-reduce:transition-none @tablet:top-0 @tablet:right-0 @tablet:left-auto @tablet:h-dvh @tablet:max-h-none @tablet:w-96 @tablet:rounded-none @tablet:rounded-l-3xl starting:open:translate-y-full @tablet:starting:open:translate-x-full @tablet:starting:open:translate-y-0"
      >
        <div className="flex h-full max-h-[85dvh] flex-col pb-[env(safe-area-inset-bottom)] @tablet:max-h-none">
          <div
            aria-hidden
            className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-surface-2 @tablet:hidden"
          />
          <div className="flex justify-end px-2 pt-1">
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar cola"
              className="flex size-11 items-center justify-center rounded-2xl text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
        </div>
      </dialog>
    </QueueDrawerContext>
  );
}

/** Opens the queue drawer. `variant="tab"` is the bottom tab bar button on mobile. */
export function QueueButton({ variant }: { variant: "header" | "tab" }) {
  const { isOpen, open } = useQueueDrawer();
  if (variant === "tab") {
    return (
      <button
        type="button"
        onClick={open}
        aria-expanded={isOpen}
        className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold text-muted transition focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none aria-expanded:text-primary"
      >
        <ListOrdered aria-hidden className="size-5" />
        Cola
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-expanded={isOpen}
      aria-label="Abrir cola"
      title="Cola"
      className="flex size-11 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
    >
      <ListOrdered aria-hidden className="size-5" />
    </button>
  );
}
