const API = "https://api.spotify.com/v1";
export const MAX_RESULTS = 20;

/** A Spotify track found by search. */
export interface SpotifyResult {
  /** `spotify:track:…`, what the player needs. */
  uri: string;
  id: string;
  title: string;
  artists: string;
  album: string;
  durationS: number;
  image: string | null;
}

export interface SpotifyProfile {
  name: string;
  /** "premium", "free"… Only Premium can play in the browser. */
  product: string | null;
}

export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

type Fetch = typeof fetch;

async function get<T>(fetcher: Fetch, path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (error) {
    throw new SpotifyApiError(0, `Spotify request failed: ${String(error)}`);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new SpotifyApiError(response.status, body.error?.message ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getProfile(token: string, fetcher: Fetch = fetch): Promise<SpotifyProfile> {
  const me = await get<{ display_name?: string | null; id?: string; product?: string }>(
    fetcher,
    "/me",
    token,
  );
  return { name: me.display_name || me.id || "Spotify", product: me.product ?? null };
}

interface SearchItem {
  id?: string;
  uri?: string;
  name?: string;
  duration_ms?: number;
  artists?: { name?: string }[];
  album?: { name?: string; images?: { url?: string; width?: number }[] };
}

export async function searchTracks(
  query: string,
  token: string,
  fetcher: Fetch = fetch,
): Promise<SpotifyResult[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: String(MAX_RESULTS) });
  const body = await get<{ tracks?: { items?: (SearchItem | null)[] } }>(
    fetcher,
    `/search?${params}`,
    token,
  );
  return (body.tracks?.items ?? []).flatMap((item) => {
    if (!item?.id || !item.uri) return [];
    // The smallest image of at least 160 px is enough for a row.
    const images = [...(item.album?.images ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    const image = images.find((i) => (i.width ?? 0) >= 160) ?? images.at(-1);
    return [
      {
        uri: item.uri,
        id: item.id,
        title: item.name ?? "Sin título",
        artists: (item.artists ?? [])
          .map((artist) => artist.name)
          .filter(Boolean)
          .join(", "),
        album: item.album?.name ?? "",
        durationS: Math.round((item.duration_ms ?? 0) / 1000),
        image: image?.url ?? null,
      },
    ];
  });
}
