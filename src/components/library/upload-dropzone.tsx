"use client";

import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUploadStore } from "@/stores/upload-store";
import { PixelCat } from "@/components/ui/pixel/pixel";

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

/**
 * "Subir" button plus a whole-window drop target: drag audio or video files
 * from the PC anywhere onto the page.
 */
export function UploadDropzone({ folderId = null }: { folderId?: string | null }) {
  const addFiles = useUploadStore((s) => s.addFiles);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // dragenter/dragleave fire for every child element: count them.
    let depth = 0;
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault(); // allows dropping (and stops the browser opening the file)
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const files = event.dataTransfer?.files;
      if (files?.length) addFiles(files, folderId);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles, folderId]);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-secondary/40 bg-surface/60 px-6 py-8 text-center transition hover:border-secondary hover:bg-surface focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        <Upload aria-hidden className="size-7 text-secondary" />
        <span className="font-display text-lg font-semibold">Subir música</span>
        <span className="text-sm text-muted">
          Arrastra archivos de audio o vídeo aquí, o pulsa para elegirlos. De los vídeos solo se
          sube el sonido
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="audio/*,video/*"
        aria-label="Elegir archivos para subir"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.files?.length) addFiles(event.target.files, folderId);
          event.target.value = ""; // picking the same file again still fires change
        }}
      />

      {dragging ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm"
        >
          <div className="rounded-3xl border-2 border-dashed border-primary border-surface-2 bg-surface px-10 py-8 text-center shadow-pixel">
            <PixelCat className="mx-auto w-16" />
            <p className="mt-2 font-display text-xl font-semibold">Suelta para subir, nya~</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
