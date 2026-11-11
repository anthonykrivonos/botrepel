import { expect, test } from "@playwright/test";
import { E2E_ORIGIN } from "./host";

test("the home page renders, offers a prompt for this server, and fits the screen @phone", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.goto("/");
  await expect(page).toHaveTitle(/BotRepel/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Human verification for websites");
  await expect(
    page.getByText(
      "BotRepel is a human verification service that checks a person is present on a form, so sites can limit automated signups.",
    ),
  ).toBeVisible();
  await expect(page.getByText(`Follow ${E2E_ORIGIN}/install.md`).first()).toBeVisible();
  // The live demo mounts after hydration with the real widget.
  await expect(page.getByRole("radio", { name: /Flash liveness/ })).toBeChecked();
  await expect(page.locator('iframe[src*="/w/br_pk_"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(errors).toEqual([]);
});

test("the entire hero prompt copies by pointer and keyboard", async ({ page }) => {
  const copiedValues: string[] = [];
  await page.exposeFunction("recordClipboardWrite", (value: string) => {
    copiedValues.push(value);
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (value: string) =>
          (window as unknown as { recordClipboardWrite(value: string): Promise<void> }).recordClipboardWrite(value),
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("radio", { name: /Flash liveness/ })).toBeAttached();

  const prompt = `Add BotRepel human verification to this app. Follow ${E2E_ORIGIN}/install.md`;
  const field = page.getByRole("button").filter({ hasText: prompt }).first();
  await expect(field).toHaveAccessibleName("Copy prompt for your coding agent");

  await field.getByText(prompt, { exact: true }).click();
  await expect.poll(() => copiedValues).toEqual([prompt]);
  await expect(field.locator('[aria-live="polite"]')).toHaveText("Copied");

  await field.click({ position: { x: 4, y: 12 } });
  await expect.poll(() => copiedValues).toEqual([prompt, prompt]);

  await field.press("Enter");
  await expect.poll(() => copiedValues).toEqual([prompt, prompt, prompt]);

  await field.press("Space");
  await expect.poll(() => copiedValues).toEqual([prompt, prompt, prompt, prompt]);
});

test("every nav and footer link resolves", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page
    .locator('header a[href^="/"], footer a[href^="/"]')
    .evaluateAll((links) => [...new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute("href")!))]);
  expect(hrefs.length).toBeGreaterThan(10);
  for (const href of hrefs) {
    const response = await request.get(href.split("#")[0] || "/", { maxRedirects: 0 });
    expect(response.status(), href).toBe(200);
  }
});

test("the legal pages render", async ({ page }) => {
  for (const [path, heading] of [
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms of service"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
});

test("an unknown page is a 404", async ({ page }) => {
  const response = await page.goto("/missing-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});
