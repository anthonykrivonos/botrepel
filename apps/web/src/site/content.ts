import { ARTICLES } from "./articles";
import { GUIDE_UPDATED } from "./guide-facts";
import { HUBS } from "./guides/hubs";
import { PRICE_MICROS, formatPerThousand } from "../shared/pricing";

export type PageKind = "home" | "page" | "article";

export interface SitePage {
  readonly path: string;
  /**
   * Title-tag text before " | BotRepel".
   * The home page stores the full title, which leads with the brand.
   * Indexable pages are sized so the full tag is 50 to 60 characters.
   */
  readonly title: string;
  readonly description: string;
  /** The only H1 on the page. */
  readonly heading: string;
  /** Listed in the sitemap and open to search engines. */
  readonly index: boolean;
  /** Sitemap lastmod, YYYY-MM-DD. */
  readonly updated?: string;
  readonly kind: PageKind;
  /** Path to a social image. Defaults to /og.png. */
  readonly image?: string;
  readonly imageAlt?: string;
}

/** Date of the public copy used for sitemap lastmod. */
export const CONTENT_UPDATED = "2026-11-10";

export const HOME_HEADING =
  "BotRepel is a human verification service that checks a person is present on a form, so sites can limit automated signups.";

/** Reviewed by the team, never indexed. */
export const designPage: SitePage = {
  path: "/design",
  title: "Design system",
  description: "BotRepel's tokens and primitives.",
  heading: "Design system",
  index: false,
  kind: "page",
};

/** Signed-in pages: rendered as empty shells, then filled in the browser. */
export const accountPages: readonly SitePage[] = [
  {
    path: "/login",
    title: "Sign in",
    description: "Sign in to BotRepel.",
    heading: "Sign in",
    index: false,
    kind: "page",
  },
  {
    path: "/dashboard",
    title: "Dashboard",
    description: "Your BotRepel sites and usage.",
    heading: "Sites",
    index: false,
    kind: "page",
  },
  {
    path: "/settings",
    title: "Settings",
    description: "Your BotRepel account settings.",
    heading: "Settings",
    index: false,
    kind: "page",
  },
  {
    path: "/device",
    title: "Connect the CLI",
    description: "Approve a BotRepel CLI sign-in.",
    heading: "Connect the CLI",
    index: false,
    kind: "page",
  },
  {
    path: "/admin/liveness",
    title: "Liveness calibration",
    description: "Light-check scores.",
    heading: "Liveness calibration",
    index: false,
    kind: "page",
  },
  {
    path: "/pass/new",
    title: "Create your Human Pass",
    description: "Create a BotRepel Human Pass.",
    heading: "Create your Human Pass",
    index: false,
    kind: "page",
  },
];

export const pages: readonly SitePage[] = [
  {
    path: "/",
    title: "BotRepel (Bot Repel): Human verification for web forms",
    description: `BotRepel adds human verification to a website form. Invisible checks are ${formatPerThousand(PRICE_MICROS.invisible)} per 1,000 successful verifications. Each token works once for five minutes.`,
    heading: "Human verification for websites",
    index: true,
    updated: "2026-11-11",
    kind: "home",
  },
  {
    path: "/docs",
    title: "Human verification docs for a website form",
    description:
      "Add human verification to a form, verify the token on your server, and choose the assurance level for each action.",
    heading: "Human verification docs",
    index: true,
    updated: CONTENT_UPDATED,
    kind: "page",
  },
  {
    path: "/about",
    title: "About BotRepel human verification for websites",
    description:
      "Review BotRepel human verification prices, retention windows, token lifetime, and the limits used by the running service.",
    heading: "About BotRepel",
    index: true,
    updated: CONTENT_UPDATED,
    kind: "page",
  },
  {
    path: "/articles",
    title: "Guides to human verification for website forms",
    description: "Read guides on blocking bots, stopping fake signups, and human verification for website forms.",
    heading: "Articles",
    index: true,
    updated: GUIDE_UPDATED,
    kind: "page",
  },
  {
    path: "/guides",
    title: "Guides to blocking bots on website forms",
    description: "Read guides on blocking bots, stopping fake signups, and adding human verification to website forms.",
    heading: "Guides",
    index: true,
    updated: GUIDE_UPDATED,
    kind: "page",
    image: "/articles/og/guides.png",
    imageAlt: "Three guide groups: block bots, stop fake accounts, and compare captcha alternatives.",
  },
  ...HUBS.map((hub): SitePage => ({
    path: hub.path,
    title: hub.title,
    description: hub.description,
    heading: hub.heading,
    index: true,
    updated: hub.updated,
    kind: "page",
    image: hub.ogImage,
    imageAlt: hub.ogAlt,
  })),
  ...ARTICLES.map((article): SitePage => ({
    path: article.path,
    title: article.title,
    description: article.description,
    heading: article.heading,
    index: true,
    updated: article.updated,
    kind: "article",
    image: article.ogImage,
    imageAlt: article.ogAlt,
  })),
  {
    path: "/privacy",
    title: "Privacy policy for BotRepel human verification",
    description:
      "Read the BotRepel privacy policy for human verification, including face crops, tokens, passkeys, and account records.",
    heading: "Privacy policy",
    index: true,
    updated: CONTENT_UPDATED,
    kind: "page",
  },
  {
    path: "/dpa",
    title: "Data processing addendum for BotRepel users",
    description: "Read how BotRepel processes visitor data for human verification when a customer adds it to a site.",
    heading: "Data processing addendum",
    index: true,
    updated: CONTENT_UPDATED,
    kind: "page",
  },
  {
    path: "/terms",
    title: "Terms of service for BotRepel customers",
    description: "Read the terms for BotRepel's human verification widget, API, dashboard, CLI, and SDKs.",
    heading: "Terms of service",
    index: true,
    updated: CONTENT_UPDATED,
    kind: "page",
  },
  designPage,
];

export const notFoundPage: SitePage = {
  path: "/404",
  title: "Page not found",
  description: "This address does not match a page.",
  heading: "Page not found",
  index: false,
  kind: "page",
};

export function pageByPath(path: string): SitePage | undefined {
  return pages.find((page) => page.path === path);
}
