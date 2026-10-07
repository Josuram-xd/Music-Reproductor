import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Purrlist" })).toBeVisible();
});

test("protected paths keep the target in ?next", async ({ page }) => {
  await page.goto("/library?folder=1");
  await expect(page).toHaveURL(/\/login\?next=%2Flibrary%3Ffolder%3D1$/);
});

test("login and register link to each other", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Regístrate" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Nombre")).toBeVisible();
  await page.getByRole("link", { name: "Inicia sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("login form validates on the server", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page.getByText("Escribe tu correo, nya~")).toBeVisible();
});
