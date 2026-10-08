"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteHistory } from "@/lib/stats/actions";
import { toast } from "@/stores/toast-store";

/** "Borrar mi historial" with a confirmation dialog. */
export function DeleteHistory({ onDeleted }: { onDeleted: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const confirm = () => {
    startTransition(async () => {
      const result = await deleteHistory();
      setOpen(false);
      if (!result.ok) {
        toast("No se pudo borrar tu historial. Inténtalo otra vez", { tone: "error" });
        return;
      }
      toast("Historial borrado. Empezamos de cero, nya~ 🐾", { tone: "success" });
      onDeleted();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="hover:text-danger"
      >
        <Trash2 aria-hidden className="size-4" />
        Borrar mi historial
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl bg-surface p-0 text-text shadow-[0_0_40px_-12px_var(--primary)] backdrop:bg-bg/60 backdrop:backdrop-blur-sm"
      >
        {open ? (
          <div className="flex flex-col gap-4 p-5">
            <h2 id={titleId} className="font-display text-xl font-semibold">
              ¿Borrar tu historial?
            </h2>
            <p className="text-sm text-muted">
              Se borran tus reproducciones, búsquedas y sesiones: las estadísticas y la radio neko
              empezarán de cero. Tus canciones, playlists y ajustes no se tocan. No se puede
              deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" autoFocus onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                pending={pending}
                onClick={confirm}
                className="bg-danger! shadow-none!"
              >
                Borrar
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
