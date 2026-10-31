import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const readOr = (path: string, fallback: string): Promise<string> => readFile(path, "utf8").catch(() => fallback);

export function parseEnv(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) {
      values.set(match[1]!, match[2]!.replace(/^(['"])(.*)\1$/, "$2"));
    }
  }
  return values;
}

/** Sets each variable, replacing an existing line or appending; other lines are kept as they were. */
export async function upsertEnv(cwd: string, file: string, entries: Readonly<Record<string, string>>): Promise<void> {
  const path = join(cwd, file);
  const lines = (await readOr(path, "")).split(/\r?\n/);
  const pending = new Map(Object.entries(entries));
  const updated = lines.map((line) => {
    const name = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (name && pending.has(name)) {
      const value = pending.get(name)!;
      pending.delete(name);
      return `${name}=${value}`;
    }
    return line;
  });
  while (updated.length && updated.at(-1) === "") {
    updated.pop();
  }
  const added = [...pending].map(([name, value]) => `${name}=${value}`);
  const text = [...updated, ...(added.length && updated.length ? [""] : []), ...added].join("\n") + "\n";
  await writeFile(path, text, { mode: 0o600 });
}

/** Adds the env file to .gitignore unless a rule already covers it, so the secret is never committed. */
export async function ensureIgnored(cwd: string, file: string): Promise<boolean> {
  const path = join(cwd, ".gitignore");
  const rules = (await readOr(path, ""))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const covered = rules.some((rule) => {
    const pattern = rule.replace(/^\//, "");
    return (
      pattern === file ||
      pattern === ".env*" ||
      pattern === ".env.*" ||
      (pattern === "*.local" && file.endsWith(".local"))
    );
  });
  if (!covered) {
    await appendFile(path, `${rules.length ? "\n" : ""}${file}\n`);
  }
  return !covered;
}
