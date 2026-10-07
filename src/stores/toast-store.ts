import { create } from "zustand";

export type ToastTone = "info" | "success" | "warn" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, options?: { tone?: ToastTone; durationMs?: number }) => number;
  dismiss: (id: number) => void;
}

const MAX_TOASTS = 3;
let nextId = 1;

export const useToastStore = create<ToastStore>()((set, get) => ({
  toasts: [],
  show(message, { tone = "info", durationMs = 4000 } = {}) {
    // The same message twice in a row (e.g. repeated ⏮) just stays on screen.
    const existing = get().toasts.find((t) => t.message === message);
    if (existing) return existing.id;
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }].slice(-MAX_TOASTS) }));
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
