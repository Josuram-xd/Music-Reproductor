// Copies @ffmpeg/ffmpeg's ESM build to public/vendor/ffmpeg so the browser can
// load it at runtime from our own origin. Bundlers cannot handle its worker
// (`new Worker(new URL(variable, import.meta.url))`), and a worker must be
// same-origin. Runs before `dev` and `build`.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const source = join("node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const target = join("public", "vendor", "ffmpeg");

if (!existsSync(source)) {
  console.error(`✖ ${source} not found. Run npm install.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const file of readdirSync(source)) {
  if (file.endsWith(".js")) cpSync(join(source, file), join(target, file));
}
console.log(`🐾 ffmpeg.wasm (ESM) copied to ${target}`);
