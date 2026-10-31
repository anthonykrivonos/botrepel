import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Io } from "./io";

interface Store {
  /** Session tokens by API origin, so local development and production stay separate. */
  readonly tokens: Record<string, string>;
}

const path = (io: Io): string =>
  join(io.env.XDG_CONFIG_HOME ?? join(io.home, ".config"), "botrepel", "credentials.json");

async function read(io: Io): Promise<Store> {
  try {
    return JSON.parse(await readFile(path(io), "utf8")) as Store;
  } catch {
    return { tokens: {} };
  }
}

export async function loadToken(io: Io, origin: string): Promise<string | null> {
  return io.env.BOTREPEL_TOKEN ?? (await read(io)).tokens[origin] ?? null;
}

/** Readable only by the user, like other CLIs' credential files. */
export async function saveToken(io: Io, origin: string, token: string): Promise<void> {
  const store = await read(io);
  const file = path(io);
  await mkdir(join(file, ".."), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify({ tokens: { ...store.tokens, [origin]: token } }, null, 2), { mode: 0o600 });
  await chmod(file, 0o600);
}

export async function forgetToken(io: Io, origin: string): Promise<void> {
  const store = await read(io);
  const { [origin]: _removed, ...tokens } = store.tokens;
  if (Object.keys(tokens).length === 0) {
    await rm(path(io), { force: true });
    return;
  }
  await writeFile(path(io), JSON.stringify({ tokens }, null, 2), { mode: 0o600 });
}
