/** Document Picture-in-Picture API (Chrome/Edge desktop): a window over other apps. */
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  readonly window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

/** Whether "Sacar de la ventana" can be offered (the button is hidden otherwise). */
export function supportsDocumentPip(win: Window = window): boolean {
  return typeof win.documentPictureInPicture?.requestWindow === "function";
}

/**
 * Copies the page styles into the PiP document, so the mini-player looks the
 * same there: inline rules when readable, `<link>` for cross-origin sheets.
 */
export function copyStyles(from: Document, to: Document): void {
  for (const sheet of [...from.styleSheets]) {
    try {
      const style = to.createElement("style");
      style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      to.head.append(style);
    } catch {
      if (!sheet.href) continue;
      const link = to.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      to.head.append(link);
    }
  }
  // Fonts and theme variables hang from <html> classes/attributes.
  to.documentElement.className = from.documentElement.className;
  for (const { name, value } of [...from.documentElement.attributes]) {
    if (name.startsWith("data-")) to.documentElement.setAttribute(name, value);
  }
}

export const PIP_SIZE = { width: 340, height: 190 };

/** Opens the PiP window with the app styles. Must run inside a user gesture. */
export async function openDocumentPip(win: Window = window): Promise<Window> {
  if (!win.documentPictureInPicture) throw new Error("Document Picture-in-Picture unsupported");
  const pip = await win.documentPictureInPicture.requestWindow(PIP_SIZE);
  copyStyles(win.document, pip.document);
  pip.document.title = "Purrlist";
  return pip;
}
