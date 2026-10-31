import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { frameworkOf } from "../src/cli/detect";
import { ensureIgnored, parseEnv, upsertEnv } from "../src/cli/env-file";
import { authLibrariesOf } from "../src/cli/guides";

describe("framework detection", () => {
  test("recognizes the frameworks whose env prefixes differ", () => {
    expect(frameworkOf({ next: "15", react: "19" })).toBe("next");
    expect(frameworkOf({ "@react-router/dev": "7", vite: "7" })).toBe("react-router");
    expect(frameworkOf({ "@sveltejs/kit": "2", vite: "7" })).toBe("sveltekit");
    expect(frameworkOf({ astro: "5" })).toBe("astro");
    expect(frameworkOf({ vite: "7" })).toBe("vite");
    expect(frameworkOf({ express: "5" })).toBe("unknown");
  });
});

describe("auth detection", () => {
  test("finds each supported auth library, most specific integration first", () => {
    expect(authLibrariesOf({ "better-auth": "1", next: "15" })).toEqual(["better-auth"]);
    expect(authLibrariesOf({ "next-auth": "5.0.0-beta.32" })).toEqual(["next-auth"]);
    expect(authLibrariesOf({ "@auth/core": "0.41" })).toEqual(["next-auth"]);
    expect(authLibrariesOf({ "@auth0/nextjs-auth0": "4" })).toEqual(["auth0"]);
    expect(authLibrariesOf({ "@clerk/nextjs": "6", "@supabase/supabase-js": "2" })).toEqual(["clerk", "supabase"]);
    expect(authLibrariesOf({ "@supabase/storage-js": "2", passport: "0.7" })).toEqual([]);
  });
});

describe("env files", () => {
  test("updates keys in place, appends new ones, and keeps everything else", async () => {
    const directory = await mkdtemp(join(tmpdir(), "botrepel-env-"));
    try {
      await writeFile(join(directory, ".env"), "# keep me\nDATABASE_URL=postgres://x\nBOTREPEL_SECRET_KEY=old\n");
      await upsertEnv(directory, ".env", { BOTREPEL_SECRET_KEY: "new", VITE_BOTREPEL_SITE_KEY: "br_pk_1" });
      const text = await readFile(join(directory, ".env"), "utf8");
      expect(text.startsWith("# keep me\nDATABASE_URL=postgres://x\nBOTREPEL_SECRET_KEY=new\n")).toBe(true);
      expect(parseEnv(text).get("VITE_BOTREPEL_SITE_KEY")).toBe("br_pk_1");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("adds the env file to .gitignore only when no rule covers it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "botrepel-env-"));
    try {
      await writeFile(join(directory, ".gitignore"), "node_modules\n.env*\n");
      expect(await ensureIgnored(directory, ".env.local")).toBe(false);
      await writeFile(join(directory, ".gitignore"), "node_modules\n");
      expect(await ensureIgnored(directory, ".env.local")).toBe(true);
      expect(await readFile(join(directory, ".gitignore"), "utf8")).toBe("node_modules\n\n.env.local\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
