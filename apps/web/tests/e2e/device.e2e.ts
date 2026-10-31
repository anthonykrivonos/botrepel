import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { E2E_ORIGIN, seedSession } from "./host";
import { signedIn } from "../../../../packages/botrepel/src/cli/init";
import type { Io } from "../../../../packages/botrepel/src/cli/io";

test("the CLI signs in through /device and gets a token scoped to the CLI @engines", async ({ page, context }) => {
  await context.addCookies(seedSession().map((cookie) => ({ ...cookie, url: E2E_ORIGIN })));
  const home = await mkdtemp(join(tmpdir(), "botrepel-e2e-"));
  let opened: (url: string) => void;
  const openedUrl = new Promise<string>((resolve) => (opened = resolve));
  const io: Io = {
    fetch,
    cwd: home,
    home,
    env: {},
    interactive: false,
    print: () => undefined,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, Math.min(ms, 250))),
    openUrl: (url) => opened(url),
    run: async () => 0,
  };
  try {
    const signingIn = signedIn(io, E2E_ORIGIN);
    await page.goto(await openedUrl);
    await expect(page.getByRole("heading", { name: "Allow the BotRepel CLI?" })).toBeVisible();
    await page.getByRole("button", { name: "Allow" }).click();
    await expect(page.getByRole("heading", { name: "Connected" })).toBeVisible();

    const token = await signingIn;
    expect(token).toMatch(/^br_cli_/);
    const sites = await page.request.get(`${E2E_ORIGIN}/v1/cli/sites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(sites.status()).toBe(200);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
