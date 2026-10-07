import { describe, expect, test } from "vitest";
import { parseCredentials, parseRegistration } from "./validation";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("parseCredentials", () => {
  test("accepts valid credentials and normalizes the email", () => {
    const result = parseCredentials(form({ email: "  Neko@Mail.COM ", password: "secret" }));
    expect(result).toEqual({ ok: true, data: { email: "neko@mail.com", password: "secret" } });
  });

  test("does not trim the password", () => {
    const result = parseCredentials(form({ email: "a@b.co", password: " pass " }));
    expect(result.ok && result.data.password).toBe(" pass ");
  });

  test("reports missing and invalid fields", () => {
    const missing = parseCredentials(form({}));
    expect(missing.ok).toBe(false);
    expect(!missing.ok && Object.keys(missing.errors).sort()).toEqual(["email", "password"]);

    const invalid = parseCredentials(form({ email: "not-an-email", password: "x" }));
    expect(!invalid.ok && invalid.errors.email).toBeTruthy();
    expect(!invalid.ok && invalid.errors.password).toBeUndefined();
  });

  test("ignores non-string form values", () => {
    const data = new FormData();
    data.set("email", new Blob(["a@b.co"]));
    data.set("password", "x");
    expect(parseCredentials(data).ok).toBe(false);
  });
});

describe("parseRegistration", () => {
  const valid = { email: "neko@mail.com", password: "purr1234", username: "  Mochi  " };

  test("accepts a valid registration and trims the username", () => {
    expect(parseRegistration(form(valid))).toEqual({
      ok: true,
      data: { email: "neko@mail.com", password: "purr1234", username: "Mochi" },
    });
  });

  test.each([
    ["too short", "ab"],
    ["too long", "x".repeat(31)],
    ["blank", "   "],
  ])("rejects a username that is %s", (_, username) => {
    const result = parseRegistration(form({ ...valid, username }));
    expect(!result.ok && result.errors.username).toBeTruthy();
  });

  test.each([
    ["shorter than 8", "abc123"],
    ["without digits", "purrpurr"],
    ["without letters", "12345678"],
  ])("rejects a password %s", (_, password) => {
    const result = parseRegistration(form({ ...valid, password }));
    expect(!result.ok && result.errors.password).toBeTruthy();
  });

  test("reports every invalid field at once", () => {
    const result = parseRegistration(form({ email: "x", password: "1", username: "" }));
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
      "email",
      "password",
      "username",
    ]);
  });
});
