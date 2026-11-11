import { GUIDE_UPDATED } from "../guide-facts";

export interface Hub {
  readonly slug: string;
  readonly path: string;
  readonly heading: string;
  readonly title: string;
  readonly description: string;
  readonly updated: string;
  readonly intro: readonly string[];
  /** Article slugs in display order. Every published article appears in one hub. */
  readonly slugs: readonly string[];
  readonly ogImage: string;
  readonly ogAlt: string;
}

export const HUBS: readonly Hub[] = [
  {
    slug: "block-bots",
    path: "/guides/block-bots",
    heading: "Block bots and scrapers",
    title: "Guides to blocking bots and site scrapers",
    description: "Read how to block scrapers and AI crawlers, and where human verification fits on a public site.",
    updated: GUIDE_UPDATED,
    intro: [
      "A public page can be copied by any client that can read it. robots.txt, rate limits, and user-agent rules each stop a different kind of automated reader, and each one leaves a gap.",
      "These guides separate what a crawler may honor from what your server can enforce. Human verification belongs on the forms that create or change an account, after those other controls.",
    ],
    slugs: [
      "block-bots-from-scraping",
      "block-ai-crawlers",
      "detect-headless-browsers",
      "filter-bot-traffic-analytics",
    ],
    ogImage: "/articles/og/block-bots.png",
    ogAlt: "Request flow from a client through robots.txt, edge rules, and a form check.",
  },
  {
    slug: "accounts",
    path: "/guides/accounts",
    heading: "Stop fake accounts and form spam",
    title: "Guides to stopping fake signup accounts",
    description: "Read how to stop fake signups, rate-limit logins, and add human verification to website forms.",
    updated: GUIDE_UPDATED,
    intro: [
      "Fake accounts and scripted logins are requests your server chooses to accept. A hidden field, a rate limit, and a human verification token each reject a different failure.",
      "The framework guides use the BotRepel widget and the siteverify API as they work in this product. Verify the token on the server before you create the account or start a session.",
    ],
    slugs: [
      "stop-fake-signups",
      "honeypot-fields",
      "rate-limit-signup-and-login",
      "credential-stuffing",
      "bot-protection-nextjs",
      "bot-protection-express",
      "bot-protection-django",
      "bot-protection-rails",
      "bot-protection-wordpress",
      "stop-bots-on-signup-forms",
      "human-verification-without-tracking",
    ],
    ogImage: "/articles/og/accounts.png",
    ogAlt: "Signup request checked by a honeypot, a rate limit, and siteverify before the account exists.",
  },
  {
    slug: "captcha",
    path: "/guides/captcha",
    heading: "Captcha alternatives",
    title: "Captcha alternatives and comparison guides",
    description: "Compare captcha alternatives for human verification, including reCAPTCHA, hCaptcha, and Turnstile.",
    updated: GUIDE_UPDATED,
    intro: [
      "A captcha asks a person to solve a test. Several products replace that test with a score, a browser challenge, or a check your server verifies.",
      "Read the comparison pages for what each vendor documents. This site does not invent prices or accessibility claims that those pages do not state.",
    ],
    slugs: [
      "captcha-alternatives",
      "bot-protection-glossary",
      "botrepel-vs-recaptcha",
      "botrepel-vs-hcaptcha",
      "botrepel-vs-cloudflare-turnstile",
    ],
    ogImage: "/articles/og/captcha.png",
    ogAlt: "Four human verification approaches: a puzzle, a score, a browser challenge, and a verified token.",
  },
];

export function hubByPath(path: string): Hub | undefined {
  return HUBS.find((hub) => hub.path === path);
}

export function hubBySlug(slug: string): Hub | undefined {
  return HUBS.find((hub) => hub.slug === slug);
}
