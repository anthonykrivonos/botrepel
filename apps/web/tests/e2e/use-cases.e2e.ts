import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const CASES = [
  {
    title: "Free AI credits and free-tier abuse",
    source: "https://frontier.replit.com/announcing-outbound-data-transfer-limits/",
  },
  { title: "SMS and voice toll fraud", source: undefined },
  {
    title: "Account takeover and credential stuffing",
    source:
      "https://blog.workflowy.com/an-update-on-the-recent-credential-stuffing-attack-against-workflowy-user-account/amp/",
  },
  {
    title: "Marketplace, ticketing and promo bots",
    source: "https://company.instacart.com/shopper-community/protecting-balancing-the-instacart-platform",
  },
  {
    title: "AI content scraping",
    source: "https://redditinc.com/hubfs/Reddit%20Inc/Content/Reddit%20v.%20SerpApi.pdf",
  },
  { title: "Fake traffic and ad leads", source: undefined },
  {
    title: "Fake accounts and user content",
    source: "https://blog.twitch.tv/en/2021/09/29/securing-your-chat-with-phone-and-email-verification/",
  },
  { title: "Human-approved agent signup", source: "https://commonpaper.com/release-notes/" },
] as const;

async function openHome(page: Page) {
  await page.goto("/");
  // The live demo mounts after hydration, when the slideshow handlers are ready too.
  await expect(page.getByRole("radio", { name: /Flash liveness/ })).toBeAttached();
}

async function expectDetails(container: Locator, useCase: (typeof CASES)[number]) {
  await expect(container.getByRole("img", { name: /^Example website:/ })).toBeVisible();
  await expect(container.getByText("Verify before", { exact: true })).toBeVisible();
  await expect(container.getByRole("link", { name: "See Integration", exact: true })).toHaveAttribute(
    "href",
    "#integrate",
  );
  const source = container.locator('a[href^="https://"]');
  await expect(source).toHaveCount(useCase.source ? 1 : 0);
  if (useCase.source) {
    await expect(source).toHaveAttribute("href", useCase.source);
  }
}

async function expectCurrentSlide(section: Locator, index: number) {
  const useCase = CASES[index]!;
  const slide = section.getByRole("group", { name: `${index + 1} of 8: ${useCase.title}`, exact: true });
  const carousel = section.getByRole("region", { name: "Use cases", exact: true });
  await expect(section.getByRole("status")).toHaveText(`${index + 1} of 8`);
  // A tall slide can extend below the viewport while its horizontal position is correct.
  await expect
    .poll(async () => {
      const [slideBounds, carouselBounds] = await Promise.all([slide.boundingBox(), carousel.boundingBox()]);
      if (!slideBounds || !carouselBounds || !slideBounds.width) {
        return 0;
      }
      const left = Math.max(slideBounds.x, carouselBounds.x);
      const right = Math.min(slideBounds.x + slideBounds.width, carouselBounds.x + carouselBounds.width);
      return Math.max(0, right - left) / slideBounds.width;
    })
    .toBeGreaterThanOrEqual(0.99);
  await expect(slide.getByRole("heading", { name: useCase.title, exact: true })).toBeVisible();
  return slide;
}

async function expectAccessibleSection(page: Page) {
  const results = await new AxeBuilder({ page })
    .include("#use-cases")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe("use-case slideshow", () => {
  // Reveal animations must be settled before layout and contrast assertions.
  test.use({ colorScheme: "dark", reducedMotion: "reduce" });

  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("next and previous navigate all slides with their sources and integration links", async ({ page }) => {
      await openHome(page);
      const section = page.locator("#use-cases");
      const carousel = section.getByRole("region", { name: "Use cases", exact: true });
      const previous = section.getByRole("button", { name: "Previous use case", exact: true });
      const next = section.getByRole("button", { name: "Next use case", exact: true });
      await carousel.scrollIntoViewIfNeeded();
      await expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
      await expect(carousel.getByRole("group", { includeHidden: true })).toHaveCount(8);
      await expect(previous).toBeDisabled();

      for (const [index, useCase] of CASES.entries()) {
        if (index > 0) {
          await next.click();
        }
        const slide = await expectCurrentSlide(section, index);
        await expect(slide).toHaveAttribute("aria-roledescription", "slide");
        await expectDetails(slide, useCase);
        await expectAccessibleSection(page);
      }
      await expect(next).toBeDisabled();

      for (let index = 6; index >= 0; index--) {
        await previous.click();
        await expectCurrentSlide(section, index);
      }
      await expect(previous).toBeDisabled();
      await expectAccessibleSection(page);
    });

    test("the carousel supports arrows, Home and End without wrapping", async ({ page }) => {
      await openHome(page);
      const section = page.locator("#use-cases");
      const carousel = section.getByRole("region", { name: "Use cases", exact: true });
      await carousel.scrollIntoViewIfNeeded();
      await carousel.focus();

      for (const [key, index] of [
        ["ArrowRight", 1],
        ["ArrowLeft", 0],
        ["ArrowLeft", 0],
        ["End", 7],
        ["ArrowRight", 7],
        ["Home", 0],
      ] as const) {
        await page.keyboard.press(key);
        await expectCurrentSlide(section, index);
        await expect(carousel).toBeFocused();
      }
    });

    test("reduced motion shows a completed preview without a cursor", async ({ page }) => {
      await openHome(page);
      const slide = await expectCurrentSlide(page.locator("#use-cases"), 0);
      const preview = slide.getByRole("img", { name: /^Example website:/ });
      await preview.scrollIntoViewIfNeeded();
      await expect(preview.locator(".mini-site-result")).toHaveCSS("opacity", "1");
      await expect(preview.locator(".mini-site-cursor")).toHaveCSS("opacity", "0");
    });

    test.describe("animation", () => {
      test.use({ reducedMotion: "no-preference" });

      test("the website preview completes verification", async ({ page }) => {
        await openHome(page);
        const slide = await expectCurrentSlide(page.locator("#use-cases"), 0);
        const preview = slide.getByRole("img", { name: /^Example website:/ });
        const result = preview.locator(".mini-site-result");
        await preview.scrollIntoViewIfNeeded();
        await expect(result).toHaveCSS("opacity", "0");
        await expect(preview.locator(".mini-site-cursor")).toHaveCSS("opacity", "1", { timeout: 3_000 });
        await expect(result).toHaveCSS("opacity", "1", { timeout: 6_000 });
      });
    });
  });

  test.describe("mobile", () => {
    test.use({ hasTouch: true });

    for (const width of [390, 320]) {
      test(`touch controls and native scrolling reveal slides without overflow at ${width}px @phone`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await openHome(page);
        const section = page.locator("#use-cases");
        const carousel = section.getByRole("region", { name: "Use cases", exact: true });
        const slides = carousel.locator("article");
        const previous = section.getByRole("button", { name: "Previous use case", exact: true });
        const next = section.getByRole("button", { name: "Next use case", exact: true });
        await carousel.scrollIntoViewIfNeeded();
        await expect(slides).toHaveCount(8);
        await expectCurrentSlide(section, 0);
        await expect(previous).toBeDisabled();

        await next.tap();
        await expectCurrentSlide(section, 1);
        await previous.tap();
        await expectCurrentSlide(section, 0);

        for (const index of [1, 2, 3, 4, 5, 6, 7, 0]) {
          // Exercise the native scroll path, independently of the navigation buttons.
          await slides.nth(index).evaluate((slide) => {
            slide.scrollIntoView({ behavior: "instant", block: "nearest", inline: "start" });
          });
          await expectCurrentSlide(section, index);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
        await expect(previous).toBeDisabled();
        await expectAccessibleSection(page);
      });
    }
  });
});
