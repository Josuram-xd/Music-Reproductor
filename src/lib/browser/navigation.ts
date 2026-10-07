/** Full page load (drops all client state). Wrapped so tests can mock it. */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
