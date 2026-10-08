import { expect, type Page, test } from "@playwright/test";

/** Public pages (the app itself needs a signed-in user). */
const PAGES = ["/login", "/register"];

async function hasHorizontalScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

for (const path of PAGES) {
  test(`${path}: fits the window without horizontal scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Purrlist" })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test(`${path}: buttons are at least 44 px tall`, async ({ page }) => {
    await page.goto(path);
    // Only the app's own buttons (next dev adds its tools button outside <main>).
    const buttons = page.locator("main").getByRole("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      const name = (await button.getAttribute("aria-label")) ?? (await button.innerText());
      expect(box?.height ?? 0, `button "${name}"`).toBeGreaterThanOrEqual(44);
    }
  });

  test(`${path}: keyboard focus is visible`, async ({ page }) => {
    await page.goto(path);
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus-visible");
    await expect(focused).toHaveCount(1);
    const outline = await focused.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    expect(outline).toBe(true);
  });
}

test("the pixel cat logo is drawn crisp, without emoji", async ({ page }) => {
  await page.goto("/login");
  const logo = page.locator("header svg[shape-rendering='crispEdges']").first();
  await expect(logo).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
});

test("reduced motion stops the animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const duration = await page
    .locator("header svg")
    .first()
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.1);
});
