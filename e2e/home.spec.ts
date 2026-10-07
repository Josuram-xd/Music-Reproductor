import { expect, test } from "@playwright/test";

test("la portada muestra el nombre de la app", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Purrlist/);
  await expect(page.getByRole("heading", { level: 1, name: "Purrlist" })).toBeVisible();
});
