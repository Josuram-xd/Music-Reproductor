import { create } from "zustand";

export type ToastTone = "info" | "success" | "warn" | "error";

/** Button inside the toast (e.g. "Deshacer"); clicking it also dismisses the toast. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastOptions {
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const MAX_TOASTS = 3;
let nextId = 1;

export const useToastStore = create<ToastStore>()((set, get) => ({
  toasts: [],
  show(message, { tone = "info", durationMs = 4000, action } = {}) {
    // The same message twice in a row (e.g. repeated ⏮) just stays on screen.
    // Toasts with an action are never merged: each one undoes something different.
    const existing = action
      ? undefined
      : get().toasts.find((t) => t.message === message && !t.action);
    if (existing) return existing.id;
    const id = nextId++;
    const added: Toast = action ? { id, message, tone, action } : { id, message, tone };
    set((state) => ({ toasts: [...state.toasts, added].slice(-MAX_TOASTS) }));
    if (durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
    return id;
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Shortcut usable outside React (event handlers, the player…). */
export const toast = (message: string, options?: Parameters<ToastStore["show"]>[1]) =>
  useToastStore.getState().show(message, options);
