/**
 * Builds the botrepel package and packs it into .cache/packages/botrepel.tgz, so a project on this
 * machine can install it before it's on npm. A local install.md tells coding agents to run this.
 * Usage: bun run pack:local
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const destination = `${root}/.cache/packages`;
await mkdir(destination, { recursive: true });

const cwd = `${root}/packages/botrepel`;
for (const command of [
  ["bun", "run", "build"],
  ["bun", "pm", "pack", "--quiet", "--filename", `${destination}/botrepel.tgz`],
]) {
  const result = Bun.spawnSync(command, { cwd, stdout: "ignore", stderr: "inherit" });
  if (!result.success) {
    process.exit(result.exitCode || 1);
  }
}
console.info(`${destination}/botrepel.tgz`);
