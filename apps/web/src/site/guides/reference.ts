import type { Article } from "../article-types";
import { diagram, guideArticle, p, ul } from "../guide-blocks";
import { ASSURANCE_SENTENCE, PRICE_SENTENCE, TOKEN_SENTENCE } from "../guide-facts";

const alternatives = guideArticle("captcha", "captcha-alternatives", {
  heading: "Captcha alternatives for website forms",
  title: "Captcha alternatives for human verification",
  description:
    "Compare captcha alternatives for human verification, using each vendor's public docs for the other products.",
  ogAlt: "Four checks side by side: a puzzle, a score, a browser challenge, and a token with an assurance level.",
  summary:
    "A captcha asks the visitor to solve a test. reCAPTCHA, hCaptcha, Turnstile, and BotRepel document different checks. Read the vendor page before you treat a feature as real. This page uses those pages for the other products and this repository for BotRepel. It does not rank them, and it does not invent prices the other pages leave out.",
  sections: [
    {
      heading: "What the visitor is being asked to do",
      blocks: [
        p(
          "The original captcha is a puzzle that is supposed to be easy for a person and hard for a script: distorted letters, an audio clip of those letters, or a grid of images. The server accepts the form when the puzzle answer matches. Newer products skip the puzzle for some visits and return a score, a browser challenge, or a token your server verifies.",
        ),
        p(
          "Those are different jobs. A score does not name a task the person completed. A browser challenge can finish with no prompt. A token can name the check that passed. Pick from the documented behavior of the product you will actually call, and keep the server as the place that allows the account to be created.",
        ),
        diagram(
          "captcha-alternatives",
          "Four columns. A puzzle captcha asks for a transcribed answer. reCAPTCHA v3 returns a score. Turnstile can run a non-interactive challenge. BotRepel returns a token marked invisible, presence, or liveness.",
          "The columns are the checks each product documents. They are not a ranking.",
        ),
      ],
    },
    {
      heading: "Accessibility of puzzles on a login form",
      blocks: [
        p(
          "W3C's understanding document for [Success Criterion 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) covers authentication of an existing account. The criterion says a cognitive function test, such as remembering a password or solving a puzzle, is not required unless the step also provides an alternative, a mechanism that helps the person complete the test, an object-recognition task, or personal content the person provided. The document says the criterion is about logging in. It does not cover creating an account. The same techniques still reduce effort during signup.",
        ),
        p(
          "The document is specific about audio. An audio version of distorted text that the person must transcribe does not meet the alternative exception. It also says object recognition, such as identifying images, can meet the letter of the criterion and should be avoided when you can, because it does not fully support people with cognitive disabilities. Password fields need to allow password managers and paste. Blocking paste fails the criterion unless another method exists.",
        ),
        p(
          "A puzzle on every login fights that criterion. A puzzle only on a suspicious login still has to leave a path that does not depend on transcription. This site does not certify any product against WCAG. Cloudflare's Turnstile overview says Turnstile is WCAG 2.2 AA compliant. That sentence is theirs. BotRepel's docs do not make a WCAG conformance claim. The widget does report no-camera when a person cannot use the camera, and the docs say to offer another way through.",
        ),
      ],
    },
    {
      heading: "reCAPTCHA",
      blocks: [
        p(
          "Google's [version guide](https://developers.google.com/recaptcha/docs/versions) lists reCAPTCHA v3, a checkbox v2 widget, and an invisible v2 badge. Version 3 returns a score and does not ask the visitor to complete a task. The checkbox can pass a click immediately or show a challenge. The invisible badge runs when a button is clicked, and Google says only the most suspicious traffic is prompted by default. The page says reCAPTCHA v1 was shut down in March 2018.",
        ),
        p(
          "A 2024 paper from ETH Zurich, [arXiv:2409.08831](https://arxiv.org/abs/2409.08831), reports solving the reCAPTCHA v2 image challenges in its test. BotRepel did not run that study. The comparison page [BotRepel and reCAPTCHA](/articles/botrepel-vs-recaptcha) stays inside those two sources. This page does not add a price for reCAPTCHA, because that guide does not state one.",
        ),
      ],
    },
    {
      heading: "hCaptcha",
      blocks: [
        p(
          "The [hCaptcha developer guide](https://docs.hcaptcha.com/) says the widget is added to a form, and a successful challenge adds an h-captcha-response field. The server POSTs that token and a secret to https://api.hcaptcha.com/siteverify. The guide says to allow the action only when success is true, and that a frontend callback does not authorize the request. Tokens are single-use. Methods such as render() and onload() are described as API-compatible with reCAPTCHA. A Content Security Policy has to allow hcaptcha.com for scripts, frames, styles, and connections.",
        ),
        p(
          "The developer guide, as used for [BotRepel and hCaptcha](/articles/botrepel-vs-hcaptcha), does not state a public per-verification price. This page does not invent one. If accessibility conformance matters for your procurement, read hCaptcha's current accessibility statement. It is not quoted here.",
        ),
      ],
    },
    {
      heading: "Cloudflare Turnstile",
      blocks: [
        p(
          "Cloudflare's [Turnstile overview](https://developers.cloudflare.com/turnstile/) says the widget can be embedded without sending the site's traffic through Cloudflare, and that it can run without showing a captcha. It describes non-interactive JavaScript challenges, including proof of work, proof of space, and probes of web APIs. Managed can show a checkbox. Non-interactive does not ask the visitor to interact. Invisible is hidden. Cloudflare says Turnstile does not access, store, or transmit form entries, and it points to a privacy addendum for the rest.",
        ),
        p(
          "The overview says Turnstile is WCAG 2.2 AA compliant. It does not list a per-verification price. BotRepel's siteverify endpoint accepts the field names secret and response, which Turnstile also uses, and adds assurance, pseudonym, and unpaid. The field overlap is a parsing convenience. The checks are not the same product. Details are on [BotRepel and Turnstile](/articles/botrepel-vs-cloudflare-turnstile).",
        ),
      ],
    },
    {
      heading: "BotRepel",
      blocks: [
        p(
          `BotRepel returns a token your server verifies at /v1/siteverify. The token names the assurance it proved: invisible, presence, or liveness. ${TOKEN_SENTENCE} ${PRICE_SENTENCE} ${ASSURANCE_SENTENCE}`,
        ),
        p(
          "The invisible check does not ask the person to transcribe text or pick images. A Human Pass is a passkey created after one light check, then reused with a tap. The light check is a two-second color sequence and a head roll. Frames are discarded at the end of the request. Numeric scores are kept for 180 days and are not linked to a person or a website, which the [privacy article](/articles/human-verification-without-tracking) states in more detail.",
        ),
        p(
          "A camera check excludes people who cannot or will not use a camera. The widget's no-camera error is the signal to offer another path you operate, such as email confirmation. Email confirmation proves the mailbox, not that a person completed a light check. Say which one you are offering. Nothing on this site certifies that combination as WCAG conformance.",
        ),
      ],
    },
    {
      heading: "A way to choose",
      blocks: [
        p("Write down the form, the threat, and the accessibility constraint before you pick a vendor."),
        ul([
          "If the form only needs to slow a script, a rate limit and a honeypot are cheaper and weaker. They are documented in the [rate limit](/articles/rate-limit-signup-and-login) and [honeypot](/articles/honeypot-fields) guides. They are not captchas.",
          "If you already depend on a Google score and a checkbox challenge, use Google's version guide to see which widget you have. Version 3 does not present a task.",
          "If you want a widget whose server API and client methods are documented as reCAPTCHA-compatible, that is what hCaptcha's guide says about its own API.",
          "If you want a Cloudflare widget that can stay non-interactive, and you want their WCAG statement, use the Turnstile overview.",
          "If you want a token that names invisible, presence, or liveness, with the prices published on this site, use BotRepel and verify it on your server. The [Next.js](/articles/bot-protection-nextjs) guide is one path. The [docs](/docs) list the others.",
        ]),
        p(
          "Whichever product you call, ignore a success flag that exists only in the browser. The hCaptcha guide and the BotRepel docs both say the server has to accept the token. Turnstile's server check is the same shape. A client callback is a convenience for the form, not the authorization.",
        ),
      ],
    },
  ],
  faqs: [
    {
      question: "Does WCAG 2.2 ban captchas on signup forms?",
      answer:
        "Success Criterion 3.3.8 is about authenticating to an existing account. W3C says it does not cover creating an account. A login step that requires transcribing a puzzle still needs a path that does not rely on that test.",
    },
    {
      question: "Which alternative is the most accurate?",
      answer:
        "This page does not score accuracy. It lists what each vendor publishes. The ETH Zurich paper reports a result for reCAPTCHA v2 images in that paper's test. It is not a comparison of the four products.",
    },
    {
      question: "Is BotRepel WCAG 2.2 AA certified?",
      answer:
        "The docs do not say that. Cloudflare's Turnstile overview does say Turnstile is WCAG 2.2 AA compliant. BotRepel's light check needs a camera, and the docs tell you to offer another path when the person cannot use one.",
    },
  ],
  related: [
    "/articles/botrepel-vs-recaptcha",
    "/articles/botrepel-vs-hcaptcha",
    "/articles/botrepel-vs-cloudflare-turnstile",
    "/articles/honeypot-fields",
    "/docs",
  ],
  sources: [
    {
      name: "Understanding SC 3.3.8 Accessible Authentication (Minimum), W3C WAI",
      href: "https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html",
    },
    {
      name: "Choosing the type of reCAPTCHA, Google for Developers",
      href: "https://developers.google.com/recaptcha/docs/versions",
    },
    { name: "Plesner, Wressnegger, et al., arXiv:2409.08831 (2024)", href: "https://arxiv.org/abs/2409.08831" },
    { name: "hCaptcha developer guide", href: "https://docs.hcaptcha.com/" },
    { name: "Cloudflare Turnstile overview", href: "https://developers.cloudflare.com/turnstile/" },
    { name: "BotRepel docs", href: "/docs" },
    { name: "BotRepel privacy policy", href: "/privacy" },
  ],
});

const glossary = guideArticle("captcha", "bot-protection-glossary", {
  heading: "A glossary of bot protection terms",
  title: "Glossary of website bot protection terms",
  description: "Definitions for bot protection terms, from robots.txt and rate limits to human verification tokens.",
  ogAlt: "A short map of terms: crawler, rate limit, captcha, and human verification token.",
  summary:
    "Use these definitions when you read the guides. A crawler, a signup bot, and a stolen-password login are different requests. The word bot covers all three in casual writing, and the control that works on one of them often does nothing for the others.",
  sections: [
    {
      heading: "Requests and clients",
      blocks: [
        diagram(
          "bot-protection-glossary",
          "Terms grouped into clients, server controls, and human verification. A crawler fetches pages. A form bot posts an action. siteverify checks a token.",
          "The groups are the words the other guides use. A control in one group does not imply a control in another.",
        ),
        p(
          "Bot. A client that sends requests without a person deciding on each one. The word does not say whether the request reads a page, creates an account, or tries a password. Name the request when you choose a control.",
        ),
        p(
          "Crawler or spider. A bot that fetches URLs to index or archive them. Googlebot, GPTBot, ClaudeBot, and CCBot are crawlers with published tokens. Cooperating crawlers read robots.txt. The [AI crawler guide](/articles/block-ai-crawlers) lists what those four operators say their tokens do.",
        ),
        p(
          "Scraper. A client that downloads pages to reuse the content. It may ignore robots.txt and it may use a normal browser. [Blocking scrapers](/articles/block-bots-from-scraping) separates this from form posts. A public HTML page can be saved by any client that can read it.",
        ),
        p(
          "Headless browser. A real browser driven by a script, often with no window. It runs JavaScript, so a check that only asks whether a script ran will pass. Detection clues such as navigator.webdriver can be changed by the tool. See [headless browsers](/articles/detect-headless-browsers).",
        ),
        p(
          "User-agent. The string a client sends to identify itself. It is chosen by the client. Google's crawler documentation warns that the HTTP user-agent string can be spoofed. Verify a claimed crawler with the operator's reverse DNS or IP list when the log line matters.",
        ),
      ],
    },
    {
      heading: "Files and network controls",
      blocks: [
        p(
          "robots.txt. A file at the host root that asks named crawlers to skip paths. [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) is the specification. Google says the instructions cannot force every crawler to obey them, and that a disallowed URL can still be indexed from other links. It is not a login wall.",
        ),
        p(
          "User-agent token. The name in a robots.txt group, such as GPTBot or Google-Extended. It can differ from the HTTP User-Agent header. Google-Extended has no separate request header. The fetch uses another Google crawler, and the token only controls how that content may be used for Gemini.",
        ),
        p(
          "WAF. A web application firewall. It applies rules to HTTP requests, often at a CDN, before your app runs. A rule can block a path, a country, or an ASN. It only sees traffic that passes through it. An origin that is reachable directly needs its own rule.",
        ),
        p(
          "Rate limit. A counter for a key, usually an IP or an account name, inside a time window. Over the limit, the server returns 429 and skips the expensive work. It slows one source. It does not identify a person. Shared NATs make a low ceiling punish real users. See [rate limits](/articles/rate-limit-signup-and-login).",
        ),
        p(
          "ASN. Autonomous system number. An identifier for a network operator, such as a hosting provider or an ISP. Blocking an ASN removes bots that egress there and also removes people on cloud desktops and some VPNs. Prefer it as a reason to require a stronger check unless that network is outside your audience.",
        ),
      ],
    },
    {
      heading: "Tests on a form",
      blocks: [
        p(
          "CAPTCHA. A test meant to tell a person from a program, often by transcription or image selection. W3C's Success Criterion 3.3.8 limits when a login may require that kind of cognitive test. The [alternatives](/articles/captcha-alternatives) page quotes the criterion and the vendor docs.",
        ),
        p(
          "Honeypot. An extra form field that people leave empty. A non-empty value is rejected. Simple posters fill it. Browser automation often skips it. Build it so assistive tech does not land in it. See [honeypot fields](/articles/honeypot-fields).",
        ),
        p(
          "Proof of work. A puzzle that spends compute, such as finding a hash with enough leading zero bits. It slows a cheap loop. A headless browser can still solve a small puzzle. OWASP lists this kind of puzzle as one way to degrade scripted logins, not as a complete defense.",
        ),
        p(
          "JavaScript challenge. A task that requires running a script before the server continues. HTTP libraries that never run scripts fail it. Headless browsers pass it. People with JavaScript disabled fail it too.",
        ),
      ],
    },
    {
      heading: "Attacks on accounts",
      blocks: [
        p(
          "Credential stuffing. Trying email and password pairs stolen from another site. It depends on password reuse. A correct password can still be a stolen one. See [credential stuffing](/articles/credential-stuffing).",
        ),
        p(
          "Password spraying. Trying a few common passwords against many accounts. The volume per account stays low, which is why a limit only on a single IP can miss it.",
        ),
        p(
          "Brute force. Trying many passwords against one account. A per-account rate limit is the direct counter. Use the same error text for an unknown user and a bad password so the limiter is not also an account oracle.",
        ),
        p(
          "Fake signup. A create-account request sent so your server inserts a user the operator will use. Stop it by refusing the insert until [siteverify succeeds](/articles/stop-fake-signups). Deleting the row later still sends mail and spends quota.",
        ),
      ],
    },
    {
      heading: "Human verification in BotRepel",
      blocks: [
        p(
          "Human verification. A check that a person completed a defined step for a named action, with the result stored as a token your server verifies. In this product the steps are the invisible check, a Human Pass, or a light check. It is not an identity document, and it is not a decision that a visitor is a bot.",
        ),
        p(
          "Liveness. Evidence that a real person is present at the camera during the check. BotRepel's light check is a two-second color sequence and a head roll. Frames are analyzed in memory and discarded. Liveness here is not a claim about who the person is.",
        ),
        p(
          "Identity. A claim that a person is a specific individual, usually from a document, a government system, or an account you already trust. BotRepel does not collect that. Do not describe a passed check as identity verification.",
        ),
        p(
          "Assurance. The level a token proved: invisible, presence, or liveness, from weakest to strongest. A token satisfies its level and every level below it. The site policy and the risk score decide which level a visit must reach.",
        ),
        p(
          `Invisible check. Proof of work plus browser signals, with no prompt when the visit stays under the policy. ${ASSURANCE_SENTENCE}`,
        ),
        p(
          "Human Pass. A passkey created after one light check. Later visits can present that passkey. The server sees a pseudonym that is stable for that pass on your site and different on every other site. Presence is the assurance name for this check.",
        ),
        p(
          "Light check. The camera sequence. The widget asks for consent before the camera starts. The no-camera error means you should offer another path. Numeric scores from the check are kept for 180 days, separated from the person and the site.",
        ),
        p(
          "Site key. The public key, prefixed br_pk_. It is safe in the browser. It identifies the site to the widget. It does not authorize siteverify.",
        ),
        p(
          "Secret key. The server key, prefixed br_sk_. It authorizes siteverify. Keep it out of client code, logs, and git. You can rotate it from the dashboard or with npx botrepel init --rotate-secret. The previous key keeps working for a short grace period.",
        ),
        p(
          `Token. The string in the botrepel-response field, prefixed br_tk_. ${TOKEN_SENTENCE} A signup token does not satisfy a login action when you set expectedAction.`,
        ),
        p(
          "siteverify. The POST to /v1/siteverify with secret and response. success is true only when the token is genuine, unused, and unexpired. The response also includes assurance, action, hostname, challenge_ts, and sometimes pseudonym, risk, and unpaid. unpaid means the account is out of credit and only the invisible check ran.",
        ),
        p(
          `Risk score. A number from 0 to 1 on the verification response. Higher means more automation signals were seen. It is an input to step-up. It is not a probability you can quote as a percentage of bots. ${PRICE_SENTENCE}`,
        ),
        p(
          "Pseudonym. The site-specific id returned when a Human Pass was used. Use it to recognize a repeat pass on your site. Do not use it as an email address or as a cross-site identifier. The derivation is described on the [privacy page](/privacy).",
        ),
      ],
    },
  ],
  faqs: [
    {
      question: "Is a passed check the same as knowing who the person is?",
      answer:
        "No. Liveness and a Human Pass say a check completed. Identity is a separate claim about a specific person, and BotRepel does not collect identity documents.",
    },
    {
      question: "Does robots.txt block signup bots?",
      answer:
        "No. robots.txt talks to crawlers that fetch pages. A signup script posts a form. Verify a token on that form.",
    },
  ],
  related: [
    "/articles/block-bots-from-scraping",
    "/articles/captcha-alternatives",
    "/articles/stop-fake-signups",
    "/articles/human-verification-without-tracking",
    "/docs",
  ],
  sources: [
    { name: "RFC 9309, Robots Exclusion Protocol", href: "https://www.rfc-editor.org/rfc/rfc9309" },
    {
      name: "Robots.txt introduction, Google Search Central",
      href: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    },
    {
      name: "Understanding SC 3.3.8, W3C WAI",
      href: "https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html",
    },
    {
      name: "Credential Stuffing Prevention Cheat Sheet, OWASP",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html",
    },
    { name: "BotRepel docs", href: "/docs" },
    { name: "BotRepel privacy policy", href: "/privacy" },
  ],
});

export const REFERENCE_ARTICLES: readonly Article[] = [alternatives, glossary];
