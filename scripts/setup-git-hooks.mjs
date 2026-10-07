// Enables the .githooks hooks on `npm install`.
// CI / Vercel have no full git repo, so it is skipped without failing.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.CI || process.env.VERCEL || !existsSync(".git")) {
  process.exit(0);
}

try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
  console.log("🐾 Git hooks enabled (.githooks)");
} catch {
  console.warn("⚠️  Could not enable git hooks (.githooks)");
}
