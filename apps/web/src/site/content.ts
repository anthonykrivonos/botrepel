import { ARTICLES } from "./articles";
import { PRICE_MICROS, formatPerThousand } from "../shared/pricing";

export type PageKind = "home" | "page" | "article";

export interface SitePage {
  readonly path: string;
  /** Title-tag text before " | BotRepel". Indexable pages are sized so the full tag is 50 to 60 characters. */
  readonly title: string;
  readonly description: string;
  /** The only H1 on the page. */
  readonly heading: string;
  /** Listed in the sitemap and open to search engines. */
  readonly index: boolean;
  /** Sitemap lastmod, YYYY-MM-DD. */
  readonly updated?: string;
  readonly kind: PageKind;
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
    title: "Human verification widget for web forms",
    description: `Add human verification to a website form. Invisible checks are ${formatPerThousand(PRICE_MICROS.invisible)} per 1,000 successful verifications. Each token works once for five minutes.`,
    heading: HOME_HEADING,
    index: true,
    updated: CONTENT_UPDATED,
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
    description:
      "Read guides to human verification and comparisons of BotRepel with reCAPTCHA, hCaptcha, and Cloudflare Turnstile.",
    heading: "Articles",
    index: true,
    updated: CONTENT_UPDATED,
    kind: "page",
  },
  ...ARTICLES.map((article): SitePage => ({
    path: article.path,
    title: article.title,
    description: article.description,
    heading: article.heading,
    index: true,
    updated: article.updated,
    kind: "article",
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
