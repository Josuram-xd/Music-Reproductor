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

test("heartbeat without a session answers 401 instead of redirecting", async ({ request }) => {
  const response = await request.post("/api/session/heartbeat", { maxRedirects: 0 });
  expect(response.status()).toBe(401);
});

test("login and register offer Google sign-in", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
});

test("an expired session shows its notice on the login page", async ({ page }) => {
  await page.goto("/login?reason=expired");
  await expect(page.getByText("Tu sesión caducó. Vuelve a entrar, nya~")).toBeVisible();
});

test("vendored ffmpeg.wasm is served as JavaScript, not redirected to login", async ({
  request,
}) => {
  const response = await request.get("/vendor/ffmpeg/index.js", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/javascript/);
});

test("upload endpoints require a session", async ({ request }) => {
  for (const path of ["/api/upload/sign", "/api/upload/complete"]) {
    const response = await request.post(path, { data: {}, maxRedirects: 0 });
    expect(response.status()).toBe(401);
  }
});
