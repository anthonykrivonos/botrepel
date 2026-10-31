import { expect, test } from "@playwright/test";

/** The seed test Playwright's planner and generator agents start from: the home page. */
test("seed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
