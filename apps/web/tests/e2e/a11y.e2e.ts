import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ORIGIN, hostPage, seedSession, seedSite } from "./host";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations(page: Page, include?: string): Promise<string[]> {
  const builder = new AxeBuilder({ page }).withTags(WCAG);
  const results = await (include ? builder.include(include) : builder).analyze();
  return results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
  );
}

test.describe("accessibility", () => {
  // Scroll-reveal sections start transparent; reduced motion shows everything, so axe sees final colors.
  test.use({ colorScheme: "dark", reducedMotion: "reduce" });

  for (const path of ["/", "/docs", "/login", "/privacy", "/terms", "/dpa"]) {
    test(`${path} has no WCAG AA violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }

  test("the dashboard and settings have no WCAG AA violations", async ({ page, context }) => {
    await context.addCookies(seedSession().map((cookie) => ({ ...cookie, url: E2E_ORIGIN })));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Sites" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("the widget's light check has no WCAG AA violations", async ({ page }) => {
    const { origin, server } = await hostPage(seedSite("localhost"));
    try {
      await page.goto(origin);
      const widget = page.frameLocator("#botrepel");
      await expect(widget.getByRole("heading", { name: "Quick light check" })).toBeVisible();
      expect(await violations(page, "#botrepel")).toEqual([]);
    } finally {
      server.close();
    }
  });
});
