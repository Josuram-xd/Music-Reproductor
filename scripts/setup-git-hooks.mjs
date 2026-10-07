// Activa los hooks de .githooks al hacer `npm install`.
// En CI / Vercel no hay repo git completo, así que se omite sin fallar.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.CI || process.env.VERCEL || !existsSync(".git")) {
  process.exit(0);
}

try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
  console.log("🐾 Hooks de git activados (.githooks)");
} catch {
  console.warn("⚠️  No se pudieron activar los hooks de git (.githooks)");
}
