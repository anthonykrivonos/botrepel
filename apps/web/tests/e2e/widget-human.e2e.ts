import { expect, test } from "@playwright/test";
import { E2E_ORIGIN, hostPage, seedSite } from "./host";

// Looks like a person's Chrome: the new headless mode reports normal client hints, and the webdriver
// flag is off. Playwright still drives the page through DevTools, which alone doesn't step up.
test.use({ channel: "chromium", launchOptions: { args: ["--disable-blink-features=AutomationControlled"] } });

test.describe("a browser without automation flags", () => {
  test("passes invisibly, hands the token to the page, and the token verifies once", async ({ page, request }) => {
    const site = seedSite("localhost");
    const { origin, server } = await hostPage(site);
    try {
      await page.goto(origin);
      await expect(page.frameLocator("#botrepel").getByRole("status")).toContainText("You're verified");
      const token = await page.evaluate(
        () =>
          (window as unknown as { botrepelMessages: { type: string; token?: string }[] }).botrepelMessages.find(
            (message) => message.type === "botrepel:token",
          )?.token,
      );
      expect(token).toMatch(/^br_tk_/);

      const verify = (): Promise<Record<string, unknown>> =>
        request
          .post(`${E2E_ORIGIN}/v1/siteverify`, { form: { secret: site.secretKey, response: token! } })
          .then((response) => response.json() as Promise<Record<string, unknown>>);
      expect(await verify()).toMatchObject({
        success: true,
        assurance: "invisible",
        action: "signup",
        hostname: "127.0.0.1",
      });
      expect(await verify()).toMatchObject({ success: false, "error-codes": ["timeout-or-duplicate"] });
    } finally {
      server.close();
    }
  });
});
