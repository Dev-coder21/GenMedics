// Build the static site into dist/ (no bundler needed):
//   TypeScript (tsc) -> ES modules, Tailwind CLI -> CSS, React UMD vendored, public/ copied.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const require = createRequire(import.meta.url);
const watchMode = process.argv.includes("--watch");

function run(label, file, args) {
  const t = Date.now();
  try {
    execFileSync(process.execPath, [file, ...args], { cwd: root, stdio: "inherit" });
  } catch (e) {
    if (label === "typescript") console.warn("  (type errors above — JS was still emitted)");
    else throw e;
  }
  console.log(`✓ ${label} ${Date.now() - t}ms`);
}

function build(full = true) {
  if (full) {
    rmSync(dist, { recursive: true, force: true });
    mkdirSync(join(dist, "vendor"), { recursive: true });
    cpSync(join(root, "public"), dist, { recursive: true });
    const umd = (pkg, f) => join(dirname(require.resolve(`${pkg}/package.json`)), "umd", f);
    cpSync(umd("react", "react.production.min.js"), join(dist, "vendor", "react.production.min.js"));
    cpSync(umd("react-dom", "react-dom.production.min.js"), join(dist, "vendor", "react-dom.production.min.js"));
    writeFileSync(join(dist, ".nojekyll"), "");
  }
  run("typescript", require.resolve("typescript/bin/tsc"), ["-p", "tsconfig.json"]);
  run("tailwind", require.resolve("tailwindcss/lib/cli.js"), ["-c", "tailwind.config.cjs", "-i", "styles/input.css", "-o", "dist/app.css", "--minify"]);
  const v = Date.now().toString(36);
  // Version every relative module import so a deploy never mixes cached old modules with new ones.
  const stamp = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name);
      if (e.isDirectory()) stamp(f);
      else if (f.endsWith(".js")) writeFileSync(f, readFileSync(f, "utf8").replace(/(from\s*|import\s*\(\s*|import\s+)(["'])(\.{1,2}\/[^"'?]+\.js)\2/g, `$1$2$3?v=${v}$2`));
    }
  };
  if (existsSync(join(dist, "app"))) stamp(join(dist, "app"));
  writeFileSync(join(dist, "index.html"), readFileSync(join(root, "index.html"), "utf8").replaceAll("__V__", v));
}

build(true);
if (watchMode) {
  console.log("watching src/, styles/, public/ …");
  let timer;
  for (const d of ["src", "styles", "public"]) {
    if (!existsSync(join(root, d))) continue;
    watch(join(root, d), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => { try { build(d === "public"); } catch (e) { console.error(e.message); } }, 150);
    });
  }
}
