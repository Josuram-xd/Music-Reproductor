import { describe, expect, test } from "vitest";
import { authErrorMessage, loginReasonMessage } from "./messages";

describe("authErrorMessage", () => {
  test("maps known Supabase error codes", () => {
    expect(authErrorMessage("invalid_credentials")).toMatch(/incorrectos/);
    expect(authErrorMessage("email_not_confirmed")).toMatch(/confirmas/);
    expect(authErrorMessage("user_already_exists")).toBe(authErrorMessage("email_exists"));
    expect(authErrorMessage("over_request_rate_limit")).toMatch(/intentos/);
  });

  test("falls back to a generic message", () => {
    expect(authErrorMessage(undefined)).toMatch(/salió mal/);
    expect(authErrorMessage("something_new")).toMatch(/salió mal/);
  });
});

describe("loginReasonMessage", () => {
  test("knows the login reasons", () => {
    expect(loginReasonMessage("expired")).toMatch(/caducó/);
    expect(loginReasonMessage("signed-out")).toMatch(/cerrada/);
    expect(loginReasonMessage("confirm-failed")).toMatch(/enlace/);
  });

  test("ignores unknown or missing reasons", () => {
    expect(loginReasonMessage(undefined)).toBeUndefined();
    expect(loginReasonMessage("<script>")).toBeUndefined();
  });
});
