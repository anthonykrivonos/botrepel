import { access, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { authLibrariesOf, type AuthLibrary } from "./guides";
import type { Io } from "./io";

export type Framework = "next" | "vite" | "react-router" | "astro" | "sveltekit" | "unknown";
export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export interface Project {
  readonly name: string;
  readonly framework: Framework;
  readonly packageManager: PackageManager;
  /** Where the framework reads local secrets from. */
  readonly envFile: string;
  /** The prefix that exposes a variable to browser code. */
  readonly publicPrefix: string;
  readonly hasPackageJson: boolean;
  /** Auth libraries in its dependencies, most specific integration first. */
  readonly auth: readonly AuthLibrary[];
}

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

const LOCKFILES: readonly [string, PackageManager][] = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

const FRAMEWORK_ENV: Readonly<Record<Framework, { envFile: string; publicPrefix: string }>> = {
  next: { envFile: ".env.local", publicPrefix: "NEXT_PUBLIC_" },
  vite: { envFile: ".env.local", publicPrefix: "VITE_" },
  "react-router": { envFile: ".env", publicPrefix: "VITE_" },
  astro: { envFile: ".env", publicPrefix: "PUBLIC_" },
  sveltekit: { envFile: ".env", publicPrefix: "PUBLIC_" },
  unknown: { envFile: ".env", publicPrefix: "" },
};

export function frameworkOf(dependencies: Readonly<Record<string, string>>): Framework {
  if (dependencies.next) {
    return "next";
  }
  if (dependencies["@sveltejs/kit"]) {
    return "sveltekit";
  }
  if (dependencies.astro) {
    return "astro";
  }
  if (dependencies["@react-router/dev"] || dependencies["@remix-run/dev"]) {
    return "react-router";
  }
  if (dependencies.vite) {
    return "vite";
  }
  return "unknown";
}

export async function detectProject(io: Io): Promise<Project> {
  let manifest: { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  let hasPackageJson = true;
  try {
    manifest = JSON.parse(await readFile(join(io.cwd, "package.json"), "utf8")) as typeof manifest;
  } catch {
    hasPackageJson = false;
  }
  const dependencies = { ...manifest.devDependencies, ...manifest.dependencies };
  const framework = frameworkOf(dependencies);
  let packageManager: PackageManager = "npm";
  for (const [file, manager] of LOCKFILES) {
    if (await exists(join(io.cwd, file))) {
      packageManager = manager;
      break;
    }
  }
  return {
    name: (manifest.name ?? basename(io.cwd)).replace(/^@[^/]+\//, "").slice(0, 80) || "My app",
    framework,
    packageManager,
    ...FRAMEWORK_ENV[framework],
    hasPackageJson,
    auth: authLibrariesOf(dependencies),
  };
}
