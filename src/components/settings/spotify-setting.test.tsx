import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SpotifyIntegration } from "@/lib/integrations/queries";
import { spotifyOAuthOrigin } from "@/lib/spotify/config";
import { useToastStore } from "@/stores/toast-store";
import { SpotifySetting } from "./spotify-setting";

const actions = vi.hoisted(() => ({
  saveSpotifyClientId: vi.fn(async () => ({ ok: true as const })),
  disconnectSpotify: vi.fn(async () => ({ ok: true as const })),
  removeSpotifyIntegration: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/integrations/spotify-actions", () => actions);
const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}));

const integration = (overrides: Partial<SpotifyIntegration> = {}): SpotifyIntegration => ({
  clientId: null,
  hasServerClientId: false,
  connected: false,
  accountName: null,
  product: null,
  ...overrides,
});
const messages = () => useToastStore.getState().toasts.map((t) => t.message);

beforeEach(() => {
  vi.clearAllMocks();
  navigation.params = new URLSearchParams();
  useToastStore.setState({ toasts: [] });
});

describe("SpotifySetting", () => {
  test("without a Client ID it shows the step-by-step guide and no connect button", () => {
    render(<SpotifySetting integration={integration()} />);
    expect(screen.getByText("panel de desarrolladores de Spotify")).toBeInTheDocument();
    expect(screen.getByText(/\/api\/spotify\/callback$/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Conectar con Spotify" })).toBeNull();
  });

  test("saves the pasted Client ID", async () => {
    render(<SpotifySetting integration={integration()} />);
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "a".repeat(32) } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar Client ID" }));
    });
    expect(actions.saveSpotifyClientId).toHaveBeenCalledWith("a".repeat(32));
  });

  test("with a Client ID and localhost it guides to the supported loopback host", () => {
    render(<SpotifySetting integration={integration({ clientId: "a".repeat(32) })} />);
    const loopbackOrigin = spotifyOAuthOrigin(window.location.origin);
    expect(screen.getByRole("status")).toHaveTextContent(/Spotify no acepta «localhost»/);
    expect(screen.getByRole("link", { name: "Abre Purrlist en 127.0.0.1" })).toHaveAttribute(
      "href",
      `${loopbackOrigin}/settings`,
    );
    expect(screen.getByText(/…aaaa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cambiarlo" }));
    expect(screen.getByText(/127\.0\.0\.1.*\/api\/spotify\/callback$/)).toBeInTheDocument();
  });

  test("the owner is also guided to the supported host when using localhost", () => {
    render(<SpotifySetting integration={integration({ hasServerClientId: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Spotify no acepta «localhost»/);
    expect(screen.queryByRole("link", { name: "Conectar con Spotify" })).toBeNull();
  });

  test("connected without Premium shows a warning", () => {
    render(
      <SpotifySetting
        integration={integration({
          clientId: "a".repeat(32),
          connected: true,
          accountName: "Neko",
          product: "free",
        })}
      />,
    );
    expect(screen.getByText("Conectado como Neko")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Premium/);
  });

  test("disconnects", async () => {
    render(<SpotifySetting integration={integration({ connected: true, product: "premium" })} />);
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    });
    expect(actions.disconnectSpotify).toHaveBeenCalledOnce();
  });

  test("tells how the OAuth round trip went and cleans the URL", () => {
    navigation.params = new URLSearchParams("spotify=connected");
    render(<SpotifySetting integration={integration({ connected: true })} />);
    expect(messages()).toEqual(["¡Nya~! Spotify conectado"]);
    expect(navigation.replace).toHaveBeenCalledWith("/settings", { scroll: false });
  });
});
