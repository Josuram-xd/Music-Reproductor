"use client";

import { Check, Copy, ExternalLink, Music2, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { SpotifyIntegration } from "@/lib/integrations/queries";
import {
  disconnectSpotify,
  removeSpotifyIntegration,
  saveSpotifyClientId,
} from "@/lib/integrations/spotify-actions";
import {
  SPOTIFY_CALLBACK_PATH,
  SPOTIFY_CONNECT_STATUSES,
  SPOTIFY_LOGIN_PATH,
  spotifyOAuthOrigin,
} from "@/lib/spotify/config";
import { CONNECT_MESSAGES, isPremium, spotifySettingErrorMessage } from "@/lib/spotify/messages";
import { toast } from "@/stores/toast-store";

const noop = () => () => {};

/** Site origin, known only in the browser. */
function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
}

/**
 * Spotify integration: a step-by-step guide to create their own Spotify app
 * (development-mode apps only accept allow-listed users, so each user brings
 * their own Client ID), then "Conectar" (OAuth PKCE) and the account status.
 */
export function SpotifySetting({ integration }: { integration: SpotifyIntegration }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const canConnect = Boolean(integration.clientId) || integration.hasServerClientId;
  const origin = useOrigin();
  const spotifyOrigin = origin ? spotifyOAuthOrigin(origin) : "";
  const requiresLoopback = Boolean(origin) && spotifyOrigin !== origin;
  const redirectUri = `${spotifyOrigin || origin}${SPOTIFY_CALLBACK_PATH}`;

  // Back from Spotify: say how it went and clean the URL.
  const status = searchParams.get("spotify");
  useEffect(() => {
    if (!status) return;
    const known = SPOTIFY_CONNECT_STATUSES.find((s) => s === status);
    const message = CONNECT_MESSAGES[known ?? "failed"];
    toast(message.text, { tone: message.ok ? "success" : "error" });
    router.replace("/settings", { scroll: false });
  }, [status, router]);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok)
        toast(spotifySettingErrorMessage(result.error ?? "failed"), { tone: "error" });
      else toast(success, { durationMs: 2500 });
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4">
      <div className="flex items-start gap-3">
        <Music2 aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">
            {integration.connected
              ? `Conectado como ${integration.accountName ?? "tu cuenta"}`
              : "Conecta tu cuenta de Spotify"}
          </p>
          <p className="text-muted">
            Escucha y busca en Spotify desde Purrlist. Solo audio; reproducir en el navegador
            requiere Spotify Premium.
          </p>
        </div>
      </div>

      {integration.connected && integration.product && !isPremium(integration.product) ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-warn/50 bg-warn/10 p-3 text-sm"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
          Tu cuenta es «{integration.product}». Spotify solo deja reproducir en otras apps con
          Premium: podrás buscar, pero no escuchar aquí.
        </p>
      ) : null}

      {integration.connected ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            pending={pending}
            onClick={() => run(disconnectSpotify, "Spotify desconectado")}
          >
            Desconectar
          </Button>
          {integration.clientId ? (
            <Button
              type="button"
              variant="ghost"
              pending={pending}
              onClick={() => run(removeSpotifyIntegration, "Client ID y conexión borrados")}
            >
              Borrar mi Client ID
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {!integration.clientId || editing ? (
            <SpotifyGuide
              hasServerClientId={integration.hasServerClientId}
              redirectUri={redirectUri}
              requiresLoopback={requiresLoopback}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <p className="text-sm text-muted">
              Client ID guardado (…{integration.clientId.slice(-4)}).{" "}
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-secondary underline-offset-4 hover:underline"
              >
                Cambiarlo
              </button>
            </p>
          )}
          {canConnect ? (
            requiresLoopback ? (
              <p role="status" className="text-sm text-warn">
                Spotify no acepta «localhost» para OAuth local.{" "}
                <a
                  href={`${spotifyOrigin}/settings`}
                  className="font-semibold text-secondary underline-offset-4 hover:underline"
                >
                  Abre Purrlist en 127.0.0.1
                </a>{" "}
                e inicia sesión allí antes de conectar.
              </p>
            ) : (
              <div>
                {/* A full navigation: the OAuth flow leaves the app and comes back. */}
                <a
                  href={SPOTIFY_LOGIN_PATH}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-5 font-display font-semibold text-bg transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
                >
                  Conectar con Spotify
                </a>
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}

function SpotifyGuide({
  hasServerClientId,
  redirectUri,
  requiresLoopback,
  onSaved,
}: {
  hasServerClientId: boolean;
  redirectUri: string;
  requiresLoopback: boolean;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("No se pudo copiar: selecciónala y cópiala a mano", { tone: "warn" });
    }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveSpotifyClientId(value);
      if (!result.ok) return setError(spotifySettingErrorMessage(result.error));
      setValue("");
      onSaved();
      toast("Client ID guardado. Ahora pulsa «Conectar con Spotify»", { tone: "success" });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {hasServerClientId ? (
        <p className="text-sm text-muted">
          Como owner puedes conectar directamente con la app del servidor, o usar la tuya:
        </p>
      ) : null}
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm marker:font-semibold marker:text-accent">
        <li>
          Entra en el{" "}
          <a
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-secondary underline-offset-4 hover:underline"
          >
            panel de desarrolladores de Spotify
            <ExternalLink aria-hidden className="size-3.5" />
          </a>{" "}
          e inicia sesión con tu cuenta.
        </li>
        <li>
          Pulsa <strong>Create app</strong>. Ponle cualquier nombre y descripción.
        </li>
        <li className="flex flex-col gap-2">
          <span>
            En <strong>Redirect URIs</strong> pega exactamente esta dirección:
          </span>
          {requiresLoopback ? (
            <span className="text-warn">
              Abre primero Purrlist en 127.0.0.1; Spotify no permite «localhost» en OAuth local.
            </span>
          ) : null}
          <span className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-bg/60 px-3 py-2 text-xs">
              {redirectUri}
            </code>
            <button
              type="button"
              onClick={copy}
              aria-label="Copiar la Redirect URI"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
            >
              {copied ? (
                <Check aria-hidden className="size-4 text-accent" />
              ) : (
                <Copy aria-hidden className="size-4" />
              )}
            </button>
          </span>
        </li>
        <li>
          En <strong>Which API/SDKs are you planning to use?</strong> marca <strong>Web API</strong>{" "}
          y <strong>Web Playback SDK</strong>, acepta y guarda.
        </li>
        <li>
          En <strong>User Management</strong> añade el email de tu cuenta de Spotify (las apps
          nuevas solo dejan entrar a esos usuarios).
        </li>
        <li>
          En <strong>Settings</strong> copia el <strong>Client ID</strong> y pégalo aquí. No hace
          falta el Client Secret.
        </li>
      </ol>
      <form onSubmit={save} className="flex flex-col gap-3" noValidate>
        <TextField
          name="spotify-client-id"
          label="Client ID"
          autoComplete="off"
          spellCheck={false}
          placeholder="32 letras y números"
          value={value}
          error={error}
          onChange={(event) => {
            setValue(event.target.value);
            setError(undefined);
          }}
        />
        <div>
          <Button type="submit" pending={pending} disabled={!value.trim()}>
            Guardar Client ID
          </Button>
        </div>
      </form>
    </div>
  );
}
