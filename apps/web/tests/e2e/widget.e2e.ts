import { expect, test } from "@playwright/test";
import { E2E_ORIGIN, hostPage, seedSite } from "./host";

test.describe("the widget on a customer's page", () => {
  test("an automated browser is caught and stepped up to the flash check @engines", async ({ page }) => {
    const site = seedSite("localhost");
    const { origin, server } = await hostPage(site);
    try {
      await page.goto(origin);
      const widget = page.frameLocator("#botrepel");
      await expect(widget.getByRole("heading", { name: "Quick light check" })).toBeVisible();
      const messages = await page.evaluate(
        () => (window as unknown as { botrepelMessages: { type: string; expanded?: boolean }[] }).botrepelMessages,
      );
      expect(messages.map((message) => message.type)).toContain("botrepel:ready");
      expect(messages).toContainEqual({ type: "botrepel:expand", expanded: true });
      expect(messages.map((message) => message.type)).not.toContain("botrepel:token");

      // Someone without a camera leaves the check, and the page learns why so it can offer another way.
      await widget.getByRole("button", { name: "Can't Use a Camera?" }).click();
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { botrepelMessages: unknown[] }).botrepelMessages))
        .toContainEqual(expect.objectContaining({ type: "botrepel:error", code: "no-camera" }));
    } finally {
      server.close();
    }
  });

  test("a site's widget can't be framed by a domain it doesn't list", async ({ page }) => {
    const site = seedSite("acme.com");
    const { origin, server } = await hostPage(site);
    try {
      await page.goto(origin);
      // Chrome replaces a frame refused by frame-ancestors with its error page.
      await expect.poll(() => page.frames().some((frame) => frame.url().startsWith("chrome-error://"))).toBe(true);
      const messages = await page.evaluate(
        () => (window as unknown as { botrepelMessages: unknown[] }).botrepelMessages,
      );
      expect(messages).toEqual([]);
      const response = await page.request.get(`${E2E_ORIGIN}/w/${site.siteKey}`);
      expect(response.headers()["content-security-policy"]).toContain("frame-ancestors https://acme.com");
    } finally {
      server.close();
    }
  });
});
