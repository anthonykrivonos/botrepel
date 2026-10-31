/**
 * Builds the published `botrepel` package: one bundle and one declaration file per subpath, with
 * the private @botrepel/protocol inlined, so users install nothing extra. Optional peers (react,
 * better-auth) stay external and are imported only by their own subpaths.
 * Usage (from packages/botrepel): bun ../../scripts/build-package.ts
 */
import { copyFile, rm } from "node:fs/promises";

const cwd = process.cwd();
const src = `${cwd}/src`;
const dist = `${cwd}/dist`;
const EXTERNAL = ["react", "react/jsx-runtime", "react-dom", "better-auth", "better-auth/*"];

/** Subpath entries, by the runtime they target. */
const SERVER_ENTRIES = ["index.ts", "better-auth/index.ts", "next-auth.ts", "auth0.ts"];
const BROWSER_ENTRIES = ["react/index.ts"];
/** Also shipped as CommonJS: Auth0 Actions and older servers `require` them. */
const CJS_ENTRIES = ["index.ts", "auth0.ts"];

await rm(dist, { recursive: true, force: true });

async function bundle(options: Partial<Bun.BuildConfig> & Pick<Bun.BuildConfig, "entrypoints">): Promise<void> {
  const result = await Bun.build({
    root: src,
    outdir: dist,
    format: "esm",
    external: EXTERNAL,
    // The production JSX runtime: React builds for production leave `jsxDEV` undefined.
    jsx: { development: false },
    minify: false,
    sourcemap: "linked",
    ...options,
  });
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
}

const at = (entries: readonly string[]): string[] => entries.map((entry) => `${src}/${entry}`);

await bundle({ entrypoints: at(SERVER_ENTRIES), target: "node" });
// Client components for the App Router; the directive must be the module's first statement.
await bundle({ entrypoints: at(BROWSER_ENTRIES), target: "browser", banner: '"use client";' });
await bundle({ entrypoints: at(CJS_ENTRIES), target: "node", format: "cjs", naming: "[dir]/[name].cjs" });
await bundle({ entrypoints: at(["cli/bin.ts"]), target: "node", banner: "#!/usr/bin/env node" });

for (const entry of [...SERVER_ENTRIES, ...BROWSER_ENTRIES]) {
  const out = `${dist}/${entry.replace(/\.ts$/, ".d.ts")}`;
  const dts = Bun.spawnSync(
    [
      "bunx",
      "dts-bundle-generator",
      "--project",
      `${cwd}/../../tsconfig.json`,
      "--inline-declare-externals",
      "--external-inlines",
      "@botrepel/protocol",
      "--no-check",
      "-o",
      out,
      `${src}/${entry}`,
    ],
    { stdout: "ignore", stderr: "inherit" },
  );
  if (dts.exitCode !== 0) {
    process.exit(dts.exitCode ?? 1);
  }
  if (CJS_ENTRIES.includes(entry)) {
    await copyFile(out, out.replace(/\.d\.ts$/, ".d.cts"));
  }
}
console.info(`Built botrepel into ${dist}`);
