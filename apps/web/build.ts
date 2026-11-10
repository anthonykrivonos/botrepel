import { cp, mkdir, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { BunPlugin } from "bun";
import tailwind from "bun-plugin-tailwind";
import { productionEnvProblems, readEnv } from "./lib/env";
import { WASM_FILES } from "./lib/liveness/models/paths";
import manifest from "./models/manifest.json";
import vercel from "../../vercel.json";
import { accountPages, notFoundPage, pages } from "./src/site/content";
import { renderDocument } from "./src/site/render";
import { discoveryFiles, resolveSeoConfig } from "./src/site/seo";

const directory = new URL("./dist/", import.meta.url);
const browserMaps = new URL("./.build/browser-sourcemaps/", import.meta.url);
const env = readEnv();
if (env.VERCEL_ENV === "production") {
  const problems = productionEnvProblems(env);
  if (problems.length) {
    throw new Error(`This production build is missing configuration:\n- ${problems.join("\n- ")}`);
  }
}
/** Only production (or MIGRATE=1) migrates, so a preview deployment can never change the production schema. */
if (env.DATABASE_URL && (env.VERCEL_ENV === "production" || env.MIGRATE === "1")) {
  await import("./lib/migrate");
}
const seo = resolveSeoConfig();
await rm(directory, { recursive: true, force: true });
await rm(browserMaps, { recursive: true, force: true });

/** React's import paths, answered by Preact's compatibility layer. */
const PREACT_PATHS: Record<string, string> = {
  react: "preact/compat",
  "react-dom": "preact/compat",
  "react-dom/client": "preact/compat/client",
  "react/jsx-runtime": "preact/jsx-runtime",
  "react/jsx-dev-runtime": "preact/jsx-runtime",
};
const preactCompat: BunPlugin = {
  name: "preact-compat",
  setup(build) {
    build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, ({ path, importer }) => {
      const target = PREACT_PATHS[path];
      if (!target) {
        throw new Error(`The widget imports ${path}, which Preact's compatibility layer doesn't map.`);
      }
      return { path: Bun.resolveSync(target, importer) };
    });
  },
};

const browserBuild = {
  // Both builds keep their paths under src/, so the widget's page stays at widget/index.html.
  root: fileURLToPath(new URL("./src/", import.meta.url)),
  outdir: fileURLToPath(directory),
  target: "browser",
  minify: true,
  sourcemap: "external",
  publicPath: "/",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  env: "PUBLIC_*",
} as const;
const site = await Bun.build({
  ...browserBuild,
  entrypoints: [fileURLToPath(new URL("./src/index.html", import.meta.url))],
  plugins: [tailwind],
});
exitOnFailure(site);
// Every customer page loads the widget, so it runs on Preact: React DOM alone is three times its size.
// Development serves it with React; the browser tests run this build.
const widget = await Bun.build({
  ...browserBuild,
  entrypoints: [fileURLToPath(new URL("./src/widget/index.html", import.meta.url))],
  plugins: [tailwind, preactCompat],
});
exitOnFailure(widget);
await assertWidgetBudget(widget);

// Source maps stay out of the deployment; CI keeps them as an artifact.
for (const output of [...site.outputs, ...widget.outputs]) {
  if (output.kind === "sourcemap" || output.path.endsWith(".js")) {
    const filename = output.path.split("/").at(-1)!;
    await Bun.write(new URL(filename, browserMaps), output);
    if (output.kind === "sourcemap") {
      await rm(output.path);
    }
  }
}

await cp(new URL("./public/", import.meta.url), directory, { recursive: true });
/** The challenge page is served by the API with per-site frame-ancestors, never as a static file. */
await mkdir(new URL("./.build/", import.meta.url), { recursive: true });
await rename(new URL("widget/index.html", directory), new URL("./.build/widget-shell.html", import.meta.url));
await rm(new URL("widget/", directory), { recursive: true, force: true });
/** Added here because Bun's HTML bundler tries to resolve preloads. Only the Latin subsets render above the fold. */
const fontPreloads = ["inter", "instrument-serif"]
  .map((name) => `<link rel="preload" href="/fonts/${name}.woff2" as="font" type="font/woff2" crossorigin>`)
  .join("");
const shell = (await Bun.file(new URL("index.html", directory)).text()).replace("<head>", `<head>${fontPreloads}`);
assertInlineStylesAllowed(shell);
for (const page of [...pages, ...accountPages, notFoundPage]) {
  const filename = page.path === "/" ? "index.html" : `${page.path.slice(1)}.html`;
  const target = new URL(filename, directory);
  await mkdir(new URL("./", target), { recursive: true });
  await Bun.write(target, renderDocument(shell, page, seo));
}
for (const [filename, content] of Object.entries(discoveryFiles(seo))) {
  await Bun.write(new URL(filename, directory), content);
}
await bundleApi();
await bundleModelRuntime();
await assertModels();
console.info(
  `Built ${pages.length} public pages, ${accountPages.length} account pages, a 404 page, and SEO resources in apps/web/dist`,
);
console.info(`Indexing: ${seo.indexable ? `enabled for ${seo.origin}` : "disabled (local or preview build)"}`);

/** One bundle, because Vercel's file tracer misses compiled-in imports and Bun's package-condition targets. */
async function bundleApi(): Promise<void> {
  exitOnFailure(
    await Bun.build({
      entrypoints: [fileURLToPath(new URL("./lib/api.ts", import.meta.url))],
      outdir: fileURLToPath(new URL(".build/", import.meta.url)),
      naming: "api.js",
      target: "bun",
      // Linked, not inline: a smaller function to load, and Bun still maps stack traces from it.
      sourcemap: "linked",
      format: "esm",
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
    }),
  );
}

/** The model runtime's wasm and loader, next to the bundle: the function ships them with the models (vercel.json includeFiles). */
async function bundleModelRuntime(): Promise<void> {
  const target = new URL("./.build/ort/", import.meta.url);
  await mkdir(target, { recursive: true });
  for (const file of WASM_FILES) {
    await cp(
      fileURLToPath(new URL(`../../node_modules/onnxruntime-web/dist/${file}`, import.meta.url)),
      fileURLToPath(new URL(file, target)),
    );
  }
}

/** Fails the build when a model file is missing or differs from models/manifest.json: a wrong model would judge every check. */
async function assertModels(): Promise<void> {
  for (const spec of Object.values(manifest.models)) {
    const file = Bun.file(new URL(`./models/${spec.file}`, import.meta.url));
    if (!(await file.exists())) {
      throw new Error(`The model apps/web/models/${spec.file} is missing.`);
    }
    const digest = new Bun.CryptoHasher("sha256").update(new Uint8Array(await file.arrayBuffer())).digest("hex");
    if (digest !== spec.sha256) {
      throw new Error(`apps/web/models/${spec.file} doesn't match models/manifest.json (sha256 ${digest}).`);
    }
  }
}

/** Fails the build unless every CSP in vercel.json lists the inline <style> hash; without it every font silently falls back. */
function assertInlineStylesAllowed(html: string): void {
  const policies = vercel.headers.flatMap((rule) =>
    rule.headers.filter((header) => header.key === "Content-Security-Policy").map((header) => header.value),
  );
  for (const [, css = ""] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const hash = `'sha256-${new Bun.CryptoHasher("sha256").update(css).digest("base64")}'`;
    if (!policies.length || policies.some((csp) => !csp.includes(hash))) {
      throw new Error(
        `The inline <style> in src/index.html changed. Add ${hash} to style-src in every policy in vercel.json.`,
      );
    }
  }
}

/** The widget loads on every customer page: it stays small, and in one script (no lazy chunks to serve). */
async function assertWidgetBudget(output: Bun.BuildOutput): Promise<void> {
  const WIDGET_BUDGET_GZIP = { js: 40 * 1024, css: 14 * 1024 } as const;
  for (const kind of ["js", "css"] as const) {
    const files = output.outputs.filter((artifact) => artifact.path.endsWith(`.${kind}`));
    if (kind === "js" && files.length !== 1) {
      console.error(`The widget must build to one script; found ${files.length}.`);
      process.exit(1);
    }
    const size = Bun.gzipSync(new Uint8Array(await files[0]!.arrayBuffer())).byteLength;
    console.info(`Widget ${kind}: ${(size / 1024).toFixed(1)} KB gzip`);
    if (size > WIDGET_BUDGET_GZIP[kind]) {
      console.error(`The widget ${kind} is ${size} B gzipped, over the ${WIDGET_BUDGET_GZIP[kind]} B budget.`);
      process.exit(1);
    }
  }
}

function exitOnFailure(output: Bun.BuildOutput): void {
  if (!output.success) {
    for (const log of output.logs) {
      console.error(log);
    }
    process.exit(1);
  }
}
