export interface UseCase {
  readonly id:
    | "free-credits"
    | "sms-voice"
    | "credential-stuffing"
    | "marketplace-bots"
    | "content-scraping"
    | "fake-leads"
    | "fake-accounts"
    | "agent-signup";
  readonly title: string;
  readonly description: string;
  readonly verifyBefore: string;
  readonly example?: {
    readonly label: "Public report" | "Product example";
    readonly company: string;
    readonly description: string;
    readonly href: string;
  };
}

/** Ordered by the cost of abuse; examples describe public reports, not customer relationships. */
export const USE_CASES: readonly UseCase[] = [
  {
    id: "free-credits",
    title: "Free AI credits and free-tier abuse",
    description: "Add a human check before granting free credits or opening a trial.",
    verifyBefore: "Signup and credit grants",
    example: {
      label: "Public report",
      company: "Replit",
      description: "Replit introduced transfer limits after resource abuse, including cryptomining and proxies.",
      href: "https://frontier.replit.com/announcing-outbound-data-transfer-limits/",
    },
  },
  {
    id: "sms-voice",
    title: "SMS and voice toll fraud",
    description: "Verify requests before they trigger paid messages or calls.",
    verifyBefore: "SMS sends and outbound calls",
  },
  {
    id: "credential-stuffing",
    title: "Account takeover and credential stuffing",
    description: "Add a human check to slow automated login and recovery attempts.",
    verifyBefore: "Login and password reset",
    example: {
      label: "Public report",
      company: "Workflowy",
      description: "Workflowy temporarily blocked logins while responding to a credential-stuffing attack.",
      href: "https://blog.workflowy.com/an-update-on-the-recent-credential-stuffing-attack-against-workflowy-user-account/amp/",
    },
  },
  {
    id: "marketplace-bots",
    title: "Marketplace, ticketing and promo bots",
    description: "Require verification before bots claim scarce inventory or promotional offers.",
    verifyBefore: "Reservations, purchases and promo claims",
    example: {
      label: "Public report",
      company: "Instacart",
      description: "Instacart documented limited cases of third-party services used to secure shopper batches.",
      href: "https://company.instacart.com/shopper-community/protecting-balancing-the-instacart-platform",
    },
  },
  {
    id: "content-scraping",
    title: "AI content scraping",
    description: "Put a human check before valuable searches, downloads or gated content.",
    verifyBefore: "Search, export and content access",
    example: {
      label: "Public report",
      company: "Reddit",
      description: "Reddit filed a lawsuit alleging unauthorized scraping by Perplexity and scraping providers.",
      href: "https://redditinc.com/hubfs/Reddit%20Inc/Content/Reddit%20v.%20SerpApi.pdf",
    },
  },
  {
    id: "fake-leads",
    title: "Fake traffic and ad leads",
    description: "Check for human involvement before accepting a lead or recording a protected conversion.",
    verifyBefore: "Lead submissions and conversions",
  },
  {
    id: "fake-accounts",
    title: "Fake accounts and user content",
    description: "Raise the cost of account farms with checks at signup and posting.",
    verifyBefore: "Signup, posting and voting",
    example: {
      label: "Public report",
      company: "Twitch",
      description: "Twitch introduced verification controls to make mass chat spam and ban evasion harder.",
      href: "https://blog.twitch.tv/en/2021/09/29/securing-your-chat-with-phone-and-email-verification/",
    },
  },
  {
    id: "agent-signup",
    title: "Human-approved agent signup",
    description: "Let an assistant handle signup, with a person verifying before the account is created.",
    verifyBefore: "Account creation",
    example: {
      label: "Product example",
      company: "Common Paper",
      description: "Common Paper lets agents create accounts, illustrating the shift toward automated onboarding.",
      href: "https://commonpaper.com/release-notes/",
    },
  },
];
