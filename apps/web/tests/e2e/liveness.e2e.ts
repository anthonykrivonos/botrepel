import { expect, test } from "@playwright/test";
import { hostPage, seedSite } from "./host";

// Chrome's fake camera plays a canned test pattern: in effect a replay, which can't reflect the
// one-time colors. The whole pipeline runs, and the check must not pass.
test.use({
  channel: "chromium",
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--disable-blink-features=AutomationControlled",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test("the flash check runs end to end, and a fake camera doesn't pass", async ({ page }) => {
  const site = seedSite("localhost", { "*": "liveness" });
  const { origin, server } = await hostPage(site);
  try {
    await page.goto(origin);
    const widget = page.frameLocator("#botrepel");
    await expect(widget.getByRole("heading", { name: "Quick light check" })).toBeVisible();
    // The host page gave the check the whole viewport.
    await expect(page.locator("#botrepel")).toHaveCSS("position", "fixed");
    await widget.getByRole("button", { name: "Continue" }).click();
    const submitted = page.waitForResponse((response) => response.url().includes("/v1/liveness/submit"));
    await widget.getByRole("button", { name: "Start" }).click();
    await expect(widget.getByText("Hold still")).toBeVisible();

    // Fails, or asks to retry with a hint; never a token.
    await expect
      .poll(
        async () => {
          const retry = await widget.getByRole("button", { name: "Try Again" }).count();
          const messages = await page.evaluate(() =>
            (window as unknown as { botrepelMessages: { type: string }[] }).botrepelMessages.map((m) => m.type),
          );
          return retry > 0 || messages.includes("botrepel:error") || messages.includes("botrepel:token");
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    const types = await page.evaluate(() =>
      (window as unknown as { botrepelMessages: { type: string }[] }).botrepelMessages.map((m) => m.type),
    );
    expect(types).not.toContain("botrepel:token");
    // The upload itself was well-formed: the server judged it rather than rejecting it.
    expect((await submitted).status()).toBe(200);
  } finally {
    server.close();
  }
});
