import { describe, expect, test, vi } from "vitest";
import { copyStyles, openDocumentPip, PIP_SIZE, supportsDocumentPip } from "./document-pip";

describe("Document Picture-in-Picture", () => {
  test("support is detected from the API", () => {
    expect(supportsDocumentPip({} as Window)).toBe(false);
    expect(
      supportsDocumentPip({
        documentPictureInPicture: { requestWindow: vi.fn(), window: null },
      } as unknown as Window),
    ).toBe(true);
  });

  test("copies readable styles inline and <html> classes/data attributes", () => {
    // Only a document with a browsing context has computed styleSheets: use the page.
    const style = document.createElement("style");
    style.textContent = ".neko { color: pink; }";
    document.head.append(style);
    document.documentElement.className = "font-vars dark";
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("lang", "es");

    const to = document.implementation.createHTMLDocument("to");
    copyStyles(document, to);
    expect(to.head.querySelector("style")?.textContent).toContain(".neko");
    expect(to.documentElement.className).toBe("font-vars dark");
    expect(to.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(to.documentElement.hasAttribute("lang")).toBe(false);

    style.remove();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  test("opens a small window with the app styles", async () => {
    const pipDocument = document.implementation.createHTMLDocument("pip");
    const requestWindow = vi.fn(async () => ({ document: pipDocument }) as unknown as Window);
    const win = {
      documentPictureInPicture: { requestWindow, window: null },
      document,
    } as unknown as Window;
    const pip = await openDocumentPip(win);
    expect(requestWindow).toHaveBeenCalledWith(PIP_SIZE);
    expect(pip.document.title).toBe("Purrlist");
  });

  test("fails clearly without support", async () => {
    await expect(openDocumentPip({} as Window)).rejects.toThrow(/unsupported/);
  });
});
