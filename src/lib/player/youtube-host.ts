/** Attribute of the element the YouTube player lives in (positioned by `YouTubeDock`). */
export const YOUTUBE_HOST_ATTR = "data-youtube-host";

let host: HTMLElement | null = null;

/**
 * The single element that holds the YouTube iframe. It is created once and
 * never moved in the DOM (moving an iframe reloads it): the UI positions it
 * over the "Ahora suena" card instead, or floats it in a corner.
 */
export function getYouTubeHost(): HTMLElement {
  if (host?.isConnected) return host;
  host = document.createElement("div");
  host.setAttribute(YOUTUBE_HOST_ATTR, "");
  host.hidden = true;
  document.body.append(host);
  return host;
}

/** The host if it exists already (the dock does not create it). */
export function findYouTubeHost(): HTMLElement | null {
  return host?.isConnected ? host : null;
}
