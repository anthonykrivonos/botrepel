import { PRICE_MICROS, formatPerThousand } from "../shared/pricing";

export interface SitePage {
  readonly path: string;
  /** The browser title; the site name is appended. */
  readonly title: string;
  readonly description: string;
  /** Listed in the sitemap and open to search engines. */
  readonly index: boolean;
}

/** Reviewed by the team, never indexed. */
export const designPage: SitePage = {
  path: "/design",
  title: "Design system",
  description: "BotRepel's tokens and primitives.",
  index: false,
};

/** Signed-in pages: rendered as empty shells, then filled in the browser. */
export const accountPages: readonly SitePage[] = [
  { path: "/login", title: "Sign in", description: "Sign in to BotRepel.", index: false },
  { path: "/dashboard", title: "Dashboard", description: "Your BotRepel sites and usage.", index: false },
  { path: "/settings", title: "Settings", description: "Your BotRepel account settings.", index: false },
  { path: "/device", title: "Connect the CLI", description: "Approve a BotRepel CLI sign-in.", index: false },
  { path: "/admin/liveness", title: "Liveness calibration", description: "Light-check scores.", index: false },
  { path: "/pass/new", title: "Create your Human Pass", description: "Create a BotRepel Human Pass.", index: false },
];

export const pages: readonly SitePage[] = [
  {
    path: "/",
    title: "Stop AI agents from abusing your site",
    description: `Drop BotRepel into your forms to keep AI agents and bots out. One line in your form, one call on your server, from ${formatPerThousand(PRICE_MICROS.invisible)} per 1,000 checks.`,
    index: true,
  },
  {
    path: "/docs",
    title: "Docs",
    description: "Add BotRepel to your form. Verify tokens on your server and set your assurance policies.",
    index: true,
  },
  {
    path: "/privacy",
    title: "Privacy policy",
    description: "What BotRepel processes to check that a person is present, and what it never keeps.",
    index: true,
  },
  {
    path: "/dpa",
    title: "Data processing addendum",
    description: "How BotRepel processes website visitors' data on its customers' behalf.",
    index: true,
  },
  {
    path: "/terms",
    title: "Terms of service",
    description: "The terms for using BotRepel's widget, API, dashboard, CLI, and SDKs.",
    index: true,
  },
  designPage,
];

export const notFoundPage: SitePage = {
  path: "/404",
  title: "Page not found",
  description: "No page at this address. There's still a way home.",
  index: false,
};
