export interface ArticleSource {
  readonly name: string;
  readonly href: string;
}

export interface ArticleSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface Article {
  readonly slug: string;
  readonly path: string;
  /** Visible H1. For an article this is the article title. */
  readonly heading: string;
  /** Title-tag text before " | BotRepel". */
  readonly title: string;
  readonly description: string;
  /** Sitemap lastmod, YYYY-MM-DD. */
  readonly updated: string;
  readonly sections: readonly ArticleSection[];
  readonly sources: readonly ArticleSource[];
}

const UPDATED = "2026-11-10";

export const ARTICLES: readonly Article[] = [
  {
    slug: "stop-bots-on-signup-forms",
    path: "/articles/stop-bots-on-signup-forms",
    heading: "How to check a signup form for automated submissions",
    title: "Add a human check to a website signup form",
    description:
      "Add human verification to a signup form and verify the token on your server before the account is created.",
    updated: UPDATED,
    sections: [
      {
        heading: "Put the widget on the form",
        paragraphs: [
          "Render the BotRepel widget inside the signup form and set its action to signup. The widget adds a hidden botrepel-response field, so a normal form post carries the token.",
          "The same action string has to be used on the server. Docs for the React component, the REST call, and the auth-library steps are at /docs.",
        ],
      },
      {
        heading: "Verify the token before you create the account",
        paragraphs: [
          "Call siteverify with your secret key and the token before the account exists. A token can be verified once, and it expires five minutes after the check.",
          "You are charged when that verification succeeds. The price follows the check the token proved: $0.50 per 1,000 invisible checks, $2.00 per 1,000 Human Pass checks, and $20.00 per 1,000 light checks.",
        ],
      },
      {
        heading: "Choose the minimum check for signup",
        paragraphs: [
          "A site policy sets the minimum assurance for the signup action. Risk can raise that minimum. A score of 0.5 requires a Human Pass. A score of 0.8 requires a light check.",
          "The invisible check is proof of work from 17 to 21 bits plus browser signals. It finishes without a prompt when the visit stays under those lines.",
          "A light check shows a two-second color sequence and asks for a head roll. The server allows 3 attempts unless LIVENESS_MAX_ATTEMPTS sets another count. Frames are discarded at the end of the request.",
        ],
      },
    ],
    sources: [
      { name: "BotRepel docs", href: "/docs" },
      { name: "BotRepel privacy policy", href: "/privacy" },
    ],
  },
  {
    slug: "human-verification-without-tracking",
    path: "/articles/human-verification-without-tracking",
    heading: "Records a human verification check keeps",
    title: "What human verification stores about visitors",
    description:
      "See which human verification records BotRepel keeps, for how long, and which camera frames it discards.",
    updated: UPDATED,
    sections: [
      {
        heading: "The invisible check",
        paragraphs: [
          "The widget solves a proof-of-work puzzle and sends a few browser signals, the site hostname, and the action name, such as signup. BotRepel keeps a keyed hash of the IP address for a short time to limit how often checks can be requested.",
          "The privacy policy says these signals are not used to identify a visitor or to follow a visitor across websites.",
        ],
      },
      {
        heading: "The light check",
        paragraphs: [
          "A light check uploads small, low-resolution face crops. They are analyzed in memory during the request and then discarded. BotRepel does not store the images or build a face template.",
          "Numeric scores from the check are kept for 180 days. The privacy policy says they are recorded by day and are not linked to a person or a website.",
        ],
      },
      {
        heading: "A Human Pass and a token",
        paragraphs: [
          "A Human Pass stores a passkey public key, a credential id, a counter, and basic authenticator details. Each site receives a different pseudonym derived from the pass.",
          "A verification token is stored as a hash with the site, action, hostname, assurance, risk score, and timestamps. Tokens and challenges are deleted one day after they expire. Abuse reports are deleted after 90 days. Rate-limit rows are deleted within hours of the window ending. The scheduled purge uses two hours past the window.",
        ],
      },
    ],
    sources: [
      { name: "BotRepel privacy policy", href: "/privacy" },
      { name: "BotRepel about page", href: "/about" },
    ],
  },
  {
    slug: "botrepel-vs-recaptcha",
    path: "/articles/botrepel-vs-recaptcha",
    heading: "BotRepel and reCAPTCHA",
    title: "Human verification: BotRepel and reCAPTCHA",
    description:
      "Compare BotRepel with reCAPTCHA for human verification, using Google's docs and a published research paper.",
    updated: UPDATED,
    sections: [
      {
        heading: "What Google documents",
        paragraphs: [
          "Google's version guide lists reCAPTCHA v3, a checkbox v2 widget, and an invisible v2 badge. Version 3 returns a score and does not ask the visitor to complete a task. The checkbox can pass a click immediately or show a challenge. The invisible badge runs when a button is clicked, and Google says only the most suspicious traffic is prompted by default.",
          "Google's page says reCAPTCHA v1 was shut down in March 2018.",
        ],
      },
      {
        heading: "A published result on v2 images",
        paragraphs: [
          "A 2024 paper from ETH Zurich, listed on arXiv as 2409.08831, reports solving the reCAPTCHA v2 image challenges in its test. BotRepel did not run that study. The figure is the paper's, and the home page cites it the same way.",
        ],
      },
      {
        heading: "What BotRepel does on the same job",
        paragraphs: [
          "BotRepel returns a token your server verifies at /v1/siteverify. The token names the assurance it proved: invisible, presence, or liveness. It is valid for five minutes and succeeds once.",
          "Invisible checks are $0.50 per 1,000 successful verifications. A Human Pass is $2.00 per 1,000. A light check is $20.00 per 1,000. Light-check frames are discarded after the request. Numeric scores are kept for 180 days.",
        ],
      },
    ],
    sources: [
      {
        name: "Choosing the type of reCAPTCHA, Google for Developers, updated 2025-11-19",
        href: "https://developers.google.com/recaptcha/docs/versions",
      },
      {
        name: "Plesner, Wressnegger, et al., arXiv:2409.08831 (2024)",
        href: "https://arxiv.org/abs/2409.08831",
      },
      { name: "BotRepel docs", href: "/docs" },
      { name: "BotRepel privacy policy", href: "/privacy" },
    ],
  },
  {
    slug: "botrepel-vs-hcaptcha",
    path: "/articles/botrepel-vs-hcaptcha",
    heading: "BotRepel and hCaptcha",
    title: "Human verification: BotRepel and hCaptcha",
    description:
      "Compare BotRepel with hCaptcha for human verification, using hCaptcha's developer guide for the other product.",
    updated: UPDATED,
    sections: [
      {
        heading: "What hCaptcha's developer guide says",
        paragraphs: [
          "The hCaptcha developer guide says the widget is added to a form, and a successful challenge adds an h-captcha-response field. The server POSTs that token and a secret to https://api.hcaptcha.com/siteverify. The guide says to allow the action only when success is true, and that a frontend callback does not authorize the request.",
          "The same guide says tokens are single-use, and that hCaptcha methods such as render() and onload() are API-compatible with reCAPTCHA. A page that uses a Content Security Policy has to allow hcaptcha.com for scripts, frames, styles, and connections.",
        ],
      },
      {
        heading: "What BotRepel asks the server to do",
        paragraphs: [
          "BotRepel also expects the server to verify a token, and it rejects a second use of the same token. The field name is botrepel-response. The siteverify body accepts secret and response, which are the field names Turnstile uses, and it adds assurance, pseudonym, and unpaid.",
          "A light check is optional and is reserved for higher-assurance actions. The camera sequence lasts two seconds. Frames from that check are not stored. A visitor who has passed one light check can save a Human Pass and use that passkey later.",
        ],
      },
      {
        heading: "Price on the BotRepel side",
        paragraphs: [
          "BotRepel charges only after siteverify succeeds. The three prices are $0.50, $2.00, and $20.00 per 1,000 verifications, for invisible, Human Pass, and light checks. hCaptcha's developer guide, as fetched for this article, does not state a public per-verification price, so this page does not invent one.",
        ],
      },
    ],
    sources: [
      { name: "hCaptcha developer guide", href: "https://docs.hcaptcha.com/" },
      { name: "BotRepel docs", href: "/docs" },
      { name: "BotRepel about page", href: "/about" },
    ],
  },
  {
    slug: "botrepel-vs-cloudflare-turnstile",
    path: "/articles/botrepel-vs-cloudflare-turnstile",
    heading: "BotRepel and Cloudflare Turnstile",
    title: "Human verification: BotRepel and Turnstile",
    description:
      "Compare BotRepel with Cloudflare Turnstile for human verification, using Cloudflare's Turnstile overview.",
    updated: UPDATED,
    sections: [
      {
        heading: "What Cloudflare's overview says",
        paragraphs: [
          "Cloudflare's Turnstile overview says the widget can be embedded without sending the site's traffic through Cloudflare, and that it can run without showing a CAPTCHA. It describes non-interactive JavaScript challenges, including proof of work, proof of space, and probes of web APIs.",
          "The same page lists three widget types. Managed can show a checkbox. Non-interactive does not ask the visitor to interact. Invisible is hidden. Cloudflare says Turnstile does not access, store, or transmit form entries or other page inputs, and it points to a privacy addendum for the rest.",
          "The overview says Turnstile is WCAG 2.2 AA compliant. It does not list a per-verification price, so this page does not state one.",
        ],
      },
      {
        heading: "Where the server APIs meet",
        paragraphs: [
          "BotRepel's siteverify endpoint accepts the field names secret and response, which Turnstile also uses, and returns assurance, pseudonym, and unpaid as well. A BotRepel token still expires in five minutes and verifies once.",
          "BotRepel's invisible check is proof of work from 17 to 21 bits plus browser signals. Risk at 0.5 steps up to a Human Pass. Risk at 0.8 steps up to a two-second camera sequence and a head roll. Those camera frames are discarded after the request.",
        ],
      },
      {
        heading: "What BotRepel charges",
        paragraphs: [
          "A successful invisible verification is $0.50 per 1,000. A Human Pass verification is $2.00 per 1,000. A light-check verification is $20.00 per 1,000. New accounts that sign in with GitHub or Google receive $5 of credit.",
        ],
      },
    ],
    sources: [
      { name: "Cloudflare Turnstile overview", href: "https://developers.cloudflare.com/turnstile/" },
      { name: "BotRepel docs", href: "/docs" },
      { name: "BotRepel privacy policy", href: "/privacy" },
    ],
  },
];

export function articleByPath(path: string): Article | undefined {
  return ARTICLES.find((article) => article.path === path);
}
