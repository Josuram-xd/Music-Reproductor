"use client";

import { ExternalLink, KeyRound } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { YouTubeIntegration } from "@/lib/integrations/queries";
import { deleteYouTubeKey, saveYouTubeKey } from "@/lib/integrations/youtube-actions";
import { youtubeKeyErrorMessage } from "@/lib/youtube/messages";
import { toast } from "@/stores/toast-store";

/**
 * The user's own YouTube API key: used before the shared one, so their
 * searches keep working when the shared daily quota runs out.
 */
export function YouTubeKeySetting({ integration }: { integration: YouTubeIntegration }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveYouTubeKey(value);
      if (!result.ok) return setError(youtubeKeyErrorMessage(result.error));
      setValue("");
      toast("¡Nya~! Tu API key de YouTube está guardada (cifrada)", { tone: "success" });
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteYouTubeKey();
      if (!result.ok) toast(youtubeKeyErrorMessage(result.error), { tone: "error" });
      else toast("Key quitada: usarás la compartida", { durationMs: 2500 });
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4">
      <div className="flex items-start gap-3">
        <KeyRound aria-hidden className="mt-0.5 size-5 shrink-0 text-secondary" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">Tu propia API key de YouTube</p>
          <p className="text-muted">
            {integration.keyHint
              ? `Guardada (${integration.keyHint}). Se usa antes que la compartida.`
              : integration.hasSharedKey
                ? "Opcional. La key compartida da unas 100 búsquedas al día para todos; con la tuya no dependes de ella."
                : "Necesaria: este servidor no tiene una key compartida."}
          </p>
        </div>
      </div>

      {integration.keyHint ? (
        <div>
          <Button type="button" variant="ghost" onClick={remove} pending={pending}>
            Quitar mi key
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3" noValidate>
          <TextField
            name="youtube-key"
            label="API key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza…"
            value={value}
            error={error}
            onChange={(event) => {
              setValue(event.target.value);
              setError(undefined);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" pending={pending} disabled={!value.trim()}>
              Guardar key
            </Button>
            <a
              href="https://developers.google.com/youtube/v3/getting-started"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-secondary underline-offset-4 hover:underline"
            >
              Cómo conseguir una
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>
          <p className="text-xs text-muted">
            Se comprueba con Google y se guarda cifrada; nunca vuelve a tu navegador.
          </p>
        </form>
      )}
    </div>
  );
}
