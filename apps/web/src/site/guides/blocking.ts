import type { Article } from "../article-types";
import { code, diagram, guideArticle, p, ul } from "../guide-blocks";
import { ASSURANCE_SENTENCE, PRICE_SENTENCE, TOKEN_SENTENCE } from "../guide-facts";

const blockBots = guideArticle("block-bots", "block-bots-from-scraping", {
  heading: "How to block bots from scraping your website",
  title: "How to block bots scraping your website",
  description: "Block scrapers with robots.txt, rate limits, and human verification on forms that create accounts.",
  ogAlt: "A request splits into a public page and a form that requires a verified token.",
  summary:
    "Ask cooperating crawlers to skip paths in robots.txt, rate-limit the URLs that are expensive or that change data, and require a human verification token before a signup, login, comment, or password reset is accepted. robots.txt does not stop a client that ignores it. A public HTML page can still be saved by anything that can read it.",
  sections: [
    {
      heading: "Name the request you want to refuse",
      blocks: [
        p(
          "Scraping means a client downloads pages so it can reuse the content. A signup bot does something else: it sends a form so your server creates a record. The same product name, bot, covers both, and the controls are different.",
        ),
        p(
          "List the URLs in two columns. One column is public reading: articles, marketing pages, images, and files you already show to visitors. The other column is a change: create account, log in, reset a password, post a comment, or submit a lead. Put the strict checks on the second column. Spend less effort trying to make a public page unreadable to a program, because the browser has to read it too.",
        ),
        diagram(
          "block-bots-from-scraping",
          "Flow chart. A client request reaches robots.txt, then an edge rate limit. Public pages are served. Forms that create or change an account stop until siteverify accepts a token.",
          "Public pages and state-changing forms need different controls. robots.txt is a request to cooperating crawlers. The form check is enforced by your server.",
        ),
      ],
    },
    {
      heading: "Use robots.txt for cooperating crawlers",
      blocks: [
        p(
          "A robots.txt file sits at the host root, for example https://example.com/robots.txt. It names a crawler and lists paths that crawler is asked not to fetch. [Google's robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro) says the file manages crawler traffic. It also says the instructions cannot force a crawler to obey them, and that a page disallowed there can still be indexed if another site links to the URL.",
        ),
        p(
          "The same page says not to use robots.txt as the way to hide a page from Google Search. To keep a page out of search results, use a noindex robots meta tag or HTTP header, or require a login. Password protection is the control for material that must not be public. robots.txt is a poor substitute, because the URL can still appear, and a client that never reads the file will fetch the page.",
        ),
        p(
          "[RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) is the current specification. Crawlers match their own product token to a group. A group you did not write does not bind a crawler that ignores the file. Syntax also differs between crawlers. Google notes that respectable crawlers follow the rules and that others might not.",
        ),
        code(
          "robots.txt",
          `User-agent: *
Disallow: /admin/
Disallow: /api/

User-agent: Googlebot
Allow: /`,
        ),
        p(
          "That sample asks every unnamed crawler to skip /admin/ and /api/, and it tells Googlebot the site is allowed. It does not make /admin/ private. If those paths must be private, require authentication on the server. The guide to [blocking named AI crawlers](/articles/block-ai-crawlers) shows separate groups for GPTBot, ClaudeBot, CCBot, and Google-Extended.",
        ),
      ],
    },
    {
      heading: "Rate-limit expensive and state-changing paths",
      blocks: [
        p(
          "A rate limit counts requests from one key, usually the client IP, inside a time window. When the count passes a threshold, the server answers 429 or a similar refusal and does not run the expensive work. This slows a scraper that fetches thousands of URLs and a script that posts the signup form in a loop. It also slows a cafe, a mobile carrier, or an office where many people share one address, so the threshold has to leave room for that.",
        ),
        p(
          "Put the tightest limit on the paths that create accounts, start sessions, reset passwords, search a large catalog, or render a heavy page. Leave ordinary article pages looser, or you will throttle real readers on a shared network. Count successful and failed attempts together. A bot that is probing does not need a 200 response to cost you database work.",
        ),
        code(
          "nginx",
          `limit_req_zone $binary_remote_addr zone=signup:10m rate=10r/m;

server {
  location /signup {
    limit_req zone=signup burst=5 nodelay;
  }
}`,
        ),
        p(
          "The nginx [limit_req module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) documents this syntax. The numbers above are an illustration: 10 signup requests a minute per IP, with a short burst. Measure your own traffic before you copy them. If the site sits behind a proxy or a CDN, use the real client IP from a header you trust, and only from that proxy. A raw X-Forwarded-For value sent by the client is not a source address.",
        ),
        p(
          "A web application firewall can apply the same idea with extra conditions: a path, a method, a country, or an autonomous system number. Cloudflare documents its [WAF](https://developers.cloudflare.com/waf/) as rules that run on traffic proxied through Cloudflare. A rule there does not protect a hostname that bypasses the proxy. Keep a copy of the rule in your server too if the origin is reachable directly.",
        ),
      ],
    },
    {
      heading: "Treat user-agent and ASN blocks as coarse filters",
      blocks: [
        p(
          "The User-Agent header is a string the client chooses. Blocking an empty agent, or an agent that names python-requests, curl, or a known scraper, removes some simple scripts. Google's [crawler list](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) warns that the HTTP user-agent string can be spoofed. A careful client sends a normal browser string. A block list of agents will also miss the next library, and it can refuse a monitoring tool you still want.",
        ),
        p(
          "An autonomous system number identifies a network operator. Blocking the ASNs of large hosting providers removes some bots that run in data centers. It also removes people who browse from a cloud desktop, a corporate egress, or a VPN that exits there. Use it as a reason to require a stronger check, not as a permanent ban, unless you have decided those networks are outside your audience. Publish the appeal path if you do ban them. A banned human cannot fix the block from inside it.",
        ),
        p(
          "If you match a claimed crawler, verify it the way that operator documents. Google publishes reverse DNS checks for Googlebot. Common Crawl publishes reverse DNS and an IP list for CCBot, and it warns that other clients pretend to be CCBot. A string match on the user agent is not that check.",
        ),
      ],
    },
    {
      heading: "Know what a JavaScript challenge does",
      blocks: [
        p(
          "A JavaScript challenge asks the client to run a script and return a result before the server sends the page or accepts the form. A plain HTTP library that never runs scripts fails the challenge. A browser, including a headless browser driven by Playwright or Puppeteer, can pass it. People who disable JavaScript, including some screen reader setups, fail it too. The [headless browsers](/articles/detect-headless-browsers) guide covers why a single browser signal is weak evidence.",
        ),
        p(
          "OWASP's [credential stuffing cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html) lists proof-of-work puzzles as one way to slow scripted logins, and it notes that client-side defenses can be spoofed. Keep a server-side decision behind the challenge. The token or cookie the script produces has to be checked on the server, bound to the action, and expired quickly. A hidden field that any client can set to true is not a challenge.",
        ),
      ],
    },
    {
      heading: "Require human verification when the server writes",
      blocks: [
        p(
          "Human verification is the check for the second column: the form that creates or changes a record. BotRepel renders a widget on that form. The widget places a token in a field named botrepel-response. Your server calls siteverify with the secret key and that token, and it creates the account only when the call succeeds.",
        ),
        p(
          `${TOKEN_SENTENCE} Compare the action and the hostname with the form you expected. ${PRICE_SENTENCE} ${ASSURANCE_SENTENCE}`,
        ),
        p(
          "This does not stop someone from reading a public page. It stops an automated client from getting a successful signup, login, or comment unless it can pass the check the policy requires. The steps for a signup form are in [stop fake signups](/articles/stop-fake-signups) and in the [docs](/docs). Privacy details, including which camera frames are discarded, are in [what a check stores](/articles/human-verification-without-tracking).",
        ),
        p(
          "Keep a path for a person who cannot use a camera. The widget reports no-camera for that case. The docs say to offer another way through, such as email verification. Do not tell that person the failure means they are a bot.",
        ),
      ],
    },
    {
      heading: "Expect copies of public pages",
      blocks: [
        p(
          "If the HTML is available to a normal browser, a program can store it. You can raise the cost with rate limits, caching, and legal terms. You cannot make the same bytes both public and impossible to copy. Pages that require a session are a different product: the server withholds the body until the session is valid.",
        ),
        p(
          "Log the refusals. A 429 count, a WAF event, and a siteverify failure with its error code tell you whether the rules are working. Do not log the verification token, the secret key, or raw camera frames. The privacy policy lists what BotRepel itself retains.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Put the controls on the right URLs",
    steps: [
      {
        name: "Split public pages from forms",
        text: "List URLs that only return public content, and URLs that create an account, start a session, reset a password, or post user content.",
      },
      {
        name: "Publish a robots.txt file",
        text: "Ask cooperating crawlers to skip paths you do not want fetched. Do not use that file as the lock on private data.",
      },
      {
        name: "Rate-limit the expensive paths",
        text: "Count requests by real client IP on signup, login, password reset, and heavy search. Leave room for shared networks.",
      },
      {
        name: "Verify a human token before you write",
        text: "On each state-changing form, check the BotRepel token with siteverify and reject the request when success is false.",
      },
      {
        name: "Read the refusal logs",
        text: "Watch 429 responses and siteverify error codes. Leave the token and the secret key out of the logs.",
      },
    ],
  },
  faqs: [
    {
      question: "Does robots.txt stop scrapers?",
      answer:
        "It asks cooperating crawlers to skip paths. Google says the instructions cannot force every crawler to obey them. A client that ignores the file can still download a public page.",
    },
    {
      question: "Will human verification stop scraping?",
      answer:
        "It checks a form before your server accepts a signup, login, or similar action. It does not hide a public HTML page from a client that can read it.",
    },
    {
      question: "Should I block data-center IP ranges?",
      answer:
        "A block also refuses people on cloud desktops and some VPNs. Prefer a higher verification requirement for those networks unless you have decided they are outside your audience.",
    },
  ],
  related: [
    "/articles/block-ai-crawlers",
    "/articles/stop-fake-signups",
    "/articles/rate-limit-signup-and-login",
    "/docs",
  ],
  sources: [
    {
      name: "Robots.txt introduction, Google Search Central, updated 2025-12-10",
      href: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    },
    { name: "RFC 9309, Robots Exclusion Protocol", href: "https://www.rfc-editor.org/rfc/rfc9309" },
    {
      name: "ngx_http_limit_req_module, nginx",
      href: "https://nginx.org/en/docs/http/ngx_http_limit_req_module.html",
    },
    { name: "Cloudflare WAF", href: "https://developers.cloudflare.com/waf/" },
    {
      name: "Google's common crawlers, updated 2026-10-30",
      href: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers",
    },
    {
      name: "Credential Stuffing Prevention Cheat Sheet, OWASP",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html",
    },
    { name: "BotRepel docs", href: "/docs" },
  ],
});

const aiCrawlers = guideArticle("block-bots", "block-ai-crawlers", {
  heading: "How to block AI crawlers in robots.txt",
  title: "Block AI crawlers with robots.txt rules",
  description: "Block GPTBot, ClaudeBot, and CCBot in robots.txt, and see what human verification still has to cover.",
  ogAlt: "Separate robots.txt groups for GPTBot, ClaudeBot, CCBot, and Google-Extended.",
  summary:
    "Put each operator's token in its own robots.txt group. Disallow GPTBot, ClaudeBot, or CCBot when you do not want that crawl, and leave Googlebot allowed if you still want Google Search. These rules bind the operators who say they honor them. They do not stop a scraper that uses another name, and they do not protect a signup form.",
  sections: [
    {
      heading: "One group per token",
      blocks: [
        p(
          "OpenAI, Anthropic, Common Crawl, and Google publish different tokens for training, search, and user-triggered fetches. A Disallow under GPTBot does not apply to OAI-SearchBot. A Disallow under ClaudeBot does not apply to Claude-SearchBot or Claude-User. Write a group for every token you want to address.",
        ),
        p(
          "Place the file at /robots.txt on every host you care about, including www and any subdomain. Anthropic's crawler article says to repeat the rule for every subdomain you want to opt out. A file on example.com does not cover app.example.com.",
        ),
        diagram(
          "block-ai-crawlers",
          "Four robots.txt groups. GPTBot and ClaudeBot are disallowed for training. OAI-SearchBot and Googlebot stay allowed. Google-Extended is a separate token that does not change Google Search.",
          "Training tokens and search tokens are separate. Disallowing GPTBot does not remove a site from Google Search.",
        ),
        code(
          "robots.txt",
          `User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Googlebot
Allow: /`,
        ),
        p(
          "The sample blocks the training crawlers those vendors name, and it allows the search crawlers and Googlebot. Change the Allow lines to Disallow if you also want to opt out of those products. Read each vendor's page before you copy a token, because the product mapping is theirs.",
        ),
      ],
    },
    {
      heading: "OpenAI: GPTBot, search, ads, and ChatGPT-User",
      blocks: [
        p(
          "OpenAI's [crawler overview](https://platform.openai.com/docs/bots) says GPTBot collects content that may be used to train generative models. Disallowing GPTBot indicates the site's content should not be used for that training. OAI-SearchBot is for showing sites in ChatGPT search. OpenAI says a site that opts out of OAI-SearchBot will not be shown in ChatGPT search answers, though it can still appear as a navigational link. The two settings are independent. If you allow both, OpenAI says it may reuse one crawl for both purposes.",
        ),
        p(
          "OAI-AdsBot visits landing pages that were submitted as ads. OpenAI says that data is not used to train foundation models. ChatGPT-User fetches pages when a person asks ChatGPT or a custom GPT to do so, including GPT Actions. OpenAI says this agent is not an automatic crawl, and that robots.txt rules may not apply because a person started the fetch. Use OAI-SearchBot, not ChatGPT-User, to manage search opt-out.",
        ),
        p(
          "OpenAI publishes IP lists for these agents on the same page. A user-agent string can be forged, so an IP match against that list is the check that a request came from OpenAI. OpenAI also says a robots.txt change can take about 24 hours to affect search.",
        ),
      ],
    },
    {
      heading: "Anthropic: ClaudeBot, Claude-SearchBot, and Claude-User",
      blocks: [
        p(
          "Anthropic's [crawler article](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) describes three robots. ClaudeBot collects content that could contribute to model training. Restricting it signals that future material should be excluded from training sets. Claude-SearchBot indexes content for search quality. Disabling it can reduce how often the site appears in Claude search answers. Claude-User fetches pages when a person asks Claude a question. Disabling it stops that retrieval and can reduce visibility for those answers.",
        ),
        p(
          "Anthropic says its bots honor robots.txt, support the non-standard Crawl-delay extension, and will not try to bypass CAPTCHAs. Other crawlers may ignore Crawl-delay. Do not assume Googlebot treats that line as a rule.",
        ),
        p(
          "The same article says blocking the source IP addresses may not be a reliable opt-out, because that can stop the crawler from reading robots.txt. As of 30 October 2026, Anthropic says it has started to honor a separate machine-readable preference for no AI training, based on an IETF draft from the aipref working group. If robots.txt names ClaudeBot, Anthropic says that group wins over the general signal. The article says the way they read the signal may change while the draft changes.",
        ),
      ],
    },
    {
      heading: "Common Crawl and Google-Extended",
      blocks: [
        p(
          "Common Crawl's [CCBot page](https://commoncrawl.org/ccbot) identifies the crawler as CCBot/2.0 and shows this opt-out:",
        ),
        code(
          "CCBot group",
          `User-agent: CCBot
Disallow: /`,
        ),
        p(
          "Common Crawl says other clients falsely use the CCBot name. CCBot publishes reverse DNS on its own hosts, except that IPv6 reverse DNS was not available when that page was written, and it publishes ranges at https://index.commoncrawl.org/ccbot.json. Check the address if a log line matters. A Disallow does not erase crawl data Common Crawl already published.",
        ),
        p(
          "Google's [common crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) page, updated 30 October 2026, says Google-Extended is a robots.txt token with no separate HTTP user agent. The fetch still uses an existing Google crawler string. The token controls whether content Google has crawled may be used to train future Gemini models and for grounding in Gemini apps and Vertex AI. Google says it does not affect inclusion or ranking in Google Search. Disallow Google-Extended when you want that opt-out. Leave the Googlebot group allowed when you want Search.",
        ),
        p(
          "The same page says Google intends to support an AIPREF training preference, with the token user-agent: __usage_ai-training, in early 2027. That is a stated plan, not a rule you can rely on today. Keep the explicit Google-Extended group until Google says the new token is in effect for your site.",
        ),
      ],
    },
    {
      heading: "What these rules leave open",
      blocks: [
        p(
          "A robots.txt opt-out is a statement to operators who choose to read it. A scraper, a browser extension, or a person using a normal browser can still save a public page. [Google's introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro) says a disallowed URL can still be indexed from links elsewhere, without a snippet. Use noindex or authentication when the goal is to stay out of a search index, and use authentication when the goal is to keep the body private.",
        ),
        p(
          "User-triggered fetchers are the awkward case. OpenAI says robots.txt may not apply to ChatGPT-User. Anthropic says a Disallow for Claude-User does stop user-directed retrieval. Read the current page for each, because the products are not the same control.",
        ),
        p(
          "None of these groups checks a signup form. A training crawler that obeys Disallow: / will not post your registration form, and a script that posts the form was never going to read robots.txt first. Add [human verification](/articles/stop-fake-signups) on the form, and a [rate limit](/articles/rate-limit-signup-and-login) on the endpoint. The broader order of controls is in [blocking bots from scraping](/articles/block-bots-from-scraping).",
        ),
      ],
    },
    {
      heading: "Check the file the crawler will actually read",
      blocks: [
        p(
          "Fetch https://example.com/robots.txt and the same path on every host that serves content, including www, a marketing subdomain, and a docs subdomain. A rule on the apex does not apply to the others. If a CDN caches the file, purge that URL after you edit it. OpenAI says a robots.txt change can take about 24 hours to affect ChatGPT search. Anthropic does not publish a delay. Google's introduction says crawlers may interpret syntax differently, so keep each group to User-agent, Allow, and Disallow lines unless the vendor documents another directive.",
        ),
        p(
          "Do not disallow the CSS and JavaScript that Googlebot needs to render a public page you still want in Search. Google's robots.txt introduction says blocking resources the crawler needs can make it understand the page less well. A training opt-out belongs on the named token, not on a User-agent: * group that also covers Googlebot. After the file is live, watch the access log for the token you disallowed. A remaining hit can be a forged user agent. Compare the IP with the list that operator publishes before you treat it as a breach of the rule.",
        ),
        p(
          "Keep a copy of the file in the repo that deploys the site, so a redesign does not replace it with an empty default. When you add a new hostname, add its robots.txt in the same change. The [glossary](/articles/bot-protection-glossary) defines the tokens if a name in the sample is unfamiliar.",
        ),
      ],
    },
  ],
  faqs: [
    {
      question: "Does blocking GPTBot remove a site from Google?",
      answer:
        "No. GPTBot is OpenAI's training crawler. Google Search uses Googlebot. Google-Extended is a separate token for Gemini training and grounding, and Google says it is not a Search ranking signal.",
    },
    {
      question: "Will a Disallow stop ChatGPT from opening a page when a person asks?",
      answer:
        "OpenAI says robots.txt rules may not apply to ChatGPT-User, because a person started the fetch. Use the OAI-SearchBot group to manage ChatGPT search.",
    },
    {
      question: "Does an AI crawler block replace a captcha on a form?",
      answer:
        "No. robots.txt talks to crawlers that fetch pages. A signup or login form still needs a server-side human verification check and a rate limit.",
    },
  ],
  related: ["/articles/block-bots-from-scraping", "/articles/stop-fake-signups", "/articles/bot-protection-glossary"],
  sources: [
    { name: "Overview of OpenAI crawlers", href: "https://platform.openai.com/docs/bots" },
    {
      name: "Does Anthropic crawl data from the web, and how can site owners block the crawler?",
      href: "https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    },
    { name: "CCBot, Common Crawl", href: "https://commoncrawl.org/ccbot" },
    {
      name: "Google's common crawlers, updated 2026-10-30",
      href: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers",
    },
    {
      name: "Robots.txt introduction, Google Search Central, updated 2025-12-10",
      href: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    },
    { name: "RFC 9309, Robots Exclusion Protocol", href: "https://www.rfc-editor.org/rfc/rfc9309" },
  ],
});

const headless = guideArticle("block-bots", "detect-headless-browsers", {
  heading: "Detecting headless browsers, and where that stops",
  title: "Headless browser detection and its limits",
  description:
    "See which headless-browser signals exist, why they can be faked, and when human verification is the check.",
  ogAlt: "A browser signal can be changed by the client. The server still has to verify a token.",
  summary:
    "A headless browser is a real browser driven by a script, often with no window on a screen. navigator.webdriver and a HeadlessChrome user agent are clues, and both can be changed by the tool that launched the browser. Accept or reject the signup on the server after siteverify. A single browser property is only a clue.",
  sections: [
    {
      heading: "What you are looking at",
      blocks: [
        p(
          "Headless means the browser runs without showing a window. Playwright, Puppeteer, and Selenium can drive Chromium, Firefox, or WebKit this way. The page's JavaScript still runs. Cookies, the DOM, and network calls still exist. A check that only asks whether JavaScript ran will pass.",
        ),
        p(
          "That is a different client from curl or python-requests, which fetch a URL and do not build a page. A JavaScript challenge or a proof-of-work puzzle slows the second kind. It is ordinary work for the first kind. OWASP's [credential stuffing cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html) makes this distinction: many attack tools post the form directly, and the ones that matter next use a real browser automation stack.",
        ),
        diagram(
          "detect-headless-browsers",
          "Three clients. A script with no JavaScript fails a browser challenge. A headless browser can pass it. The server accepts the form only after siteverify returns success.",
          "A headless browser can complete a JavaScript challenge. The accept or reject decision stays on the server.",
        ),
      ],
    },
    {
      heading: "Signals that show up in commodity tools",
      blocks: [
        p(
          "[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver) documents navigator.webdriver. It is true when the browser is controlled by automation. Older headless Chromium builds also put HeadlessChrome in the user agent. Scripts that forget to patch these are easy to count in logs and in the page.",
        ),
        p(
          "Other checks you will see in write-ups include a missing plugins list, a WebGL renderer string that names a software GPU, inconsistent screen and window sizes, and languages or time zones that do not match the IP. Some of these correlate with automation. They also correlate with virtual machines, remote desktops, privacy browsers, and locked-down office images.",
        ),
        ul([
          "navigator.webdriver is a defined automation flag, and the automation tool can launch the browser so the flag is false.",
          "The user agent is a header and a JavaScript value. The client picks both.",
          "Plugin lists, fonts, and WebGL strings describe the environment. A full browser profile can look ordinary.",
          "One mismatch is a reason to ask for a stronger check. A mismatch is not, by itself, proof of a bot or of a person.",
        ]),
      ],
    },
    {
      heading: "Why the signal moves",
      blocks: [
        p(
          "The tool and the site are in an arms race the site does not see. When a detection post becomes popular, the automation libraries add a flag or a stealth plugin that changes the reported value. A rule you copied last year can be wrong in both directions: it misses current Playwright, and it still flags a person on an unusual GPU.",
        ),
        p(
          "Do not ship a long client-side score as the thing your server trusts. The browser can run any script you send, and it can also run a different script and post the answers the server hopes to see. BotRepel's docs state the same limit for its own browser evidence: the hostname on a token comes from the embedding page in a normal browser, and that evidence is not proof against a custom client. The action check and the single use of the token are what the server can enforce.",
        ),
      ],
    },
    {
      heading: "What the server can actually require",
      blocks: [
        p(
          "Rate-limit the login and signup routes so a farm of browsers has a budget. The [rate limit guide](/articles/rate-limit-signup-and-login) shows per-IP and per-account counters. OWASP notes that stuffing tools spread attempts across many proxies, so a single IP limit is not the whole defense. Pair it with a check that does not depend on the IP.",
        ),
        p(
          `Require a BotRepel token on the form. ${TOKEN_SENTENCE} ${ASSURANCE_SENTENCE} A headless browser can still attempt the invisible proof of work. The policy can require a Human Pass or a light check for the action when the risk score is high. Those steps are defined in the [docs](/docs). They are not a claim that every automated browser will fail them.`,
        ),
        p(
          "Log a boolean and the error code from siteverify. Leave the token, the secret, the IP hash BotRepel stores, and any camera frame out of your logs. [What a check stores](/articles/human-verification-without-tracking) lists BotRepel's retention. Your own access log is a separate system.",
        ),
      ],
    },
    {
      heading: "Limits you should write down",
      blocks: [
        p(
          "Detection does not identify a person, and it does not identify a bot with certainty. A positive navigator.webdriver result means the browser says it is automated. A negative result means the browser did not say that. People who disable JavaScript never produce the signals, and OWASP warns that blocking them reduces access, especially for some screen reader users, and can conflict with equality law in some places.",
        ),
        p(
          "Do not show a visitor a message that calls them a bot because a heuristic fired. Say that the check did not pass, and offer the recovery your policy allows: retry, a Human Pass, email verification, or support. The [captcha alternatives](/articles/captcha-alternatives) guide covers why a puzzle is a poor recovery for people who cannot solve one.",
        ),
      ],
    },
    {
      heading: "A practical bar for this month",
      blocks: [
        p(
          "Log navigator.webdriver and the user agent on signup and login failures, next to the siteverify error code. Do not block the request on the flag alone. After a week, count how often the flag is true on attempts that also failed siteverify, and how often it is true on attempts that succeeded and later looked like real customers. If the second count is not zero, the flag is already punishing people. Keep it as a log field.",
        ),
        p(
          "Retest when you upgrade the browser tooling you use in CI. A headless Chrome that your own Playwright suite launches should be able to complete a test login that you have marked as a test, or the suite should stub verify(). It should not be able to create a production account by posting the form with no token. Those are different environments. A production bypass that exists so CI can pass is the hole a headless browser will use.",
        ),
        p(
          "When the risk on a real signup is high, raise minAssurance for that action instead of adding another client-side probe. The server still checks the token, the action, and the hostname. A new probe in the page can be skipped by a client that never runs it and posts the field your old JavaScript used to set. Review the [scraping guide](/articles/block-bots-from-scraping) if the traffic you care about is reading pages, not submitting the form. Re-read the flag counts after each browser upgrade in your own test suite, because a library release can flip navigator.webdriver without changing your server.",
        ),
      ],
    },
  ],
  faqs: [
    {
      question: "Does navigator.webdriver prove a browser is headless?",
      answer:
        "It reports the automation flag defined by the browser. Automation tools can run with that flag set to false. A true value is a clue. A false value is not a proof of a person.",
    },
    {
      question: "Can a headless browser pass an invisible check?",
      answer:
        "It can run the page's JavaScript, including a proof-of-work puzzle. Treat the server verification result as the decision, and raise the required assurance for actions that need more than that puzzle.",
    },
  ],
  related: [
    "/articles/block-bots-from-scraping",
    "/articles/credential-stuffing",
    "/articles/captcha-alternatives",
    "/docs",
  ],
  sources: [
    {
      name: "Navigator.webdriver, MDN",
      href: "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver",
    },
    {
      name: "Credential Stuffing Prevention Cheat Sheet, OWASP",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html",
    },
    { name: "BotRepel docs", href: "/docs" },
    { name: "BotRepel privacy policy", href: "/privacy" },
  ],
});

const analytics = guideArticle("block-bots", "filter-bot-traffic-analytics", {
  heading: "How to spot bot traffic in analytics",
  title: "Filter bot traffic in website analytics",
  description:
    "See how Google Analytics excludes known bots, and which human verification failures belong in server logs.",
  ogAlt: "Server logs and an analytics report side by side. Known bots are missing from the analytics report.",
  summary:
    "Google Analytics 4 already drops traffic it classifies as known bots and spiders, and you cannot turn that filter off or see the dropped volume. Use the analytics report for people who executed your tag. Use server and firewall logs to see scrapers, failed signups, and clients that never ran the tag. Do not invent a bot percentage from the gap between the two.",
  sections: [
    {
      heading: "What the analytics tag can see",
      blocks: [
        p(
          "A page-view tag runs in the browser after the page loads and JavaScript executes. Clients that only download HTML with curl, clients that block the tag, and clients that leave before it runs are absent from the report. A headless browser that executes the tag can appear as a normal session.",
        ),
        p(
          "Google's help page on [known bot-traffic exclusion](https://support.google.com/analytics/answer/9888366) says GA4 properties automatically exclude traffic from known bots and spiders. The exclusion uses Google's research and the Interactive Advertising Bureau's International Spiders and Bots list. Google says you cannot disable the exclusion and you cannot see how much traffic was excluded.",
        ),
        diagram(
          "filter-bot-traffic-analytics",
          "Requests hit the server log. Known bots and spiders are excluded from Google Analytics. Clients that never run the tag are also missing from Analytics. Failed form posts remain in the server log.",
          "Analytics shows clients that ran the tag and were not on the known-bot list. The server log still has the rest.",
        ),
      ],
    },
    {
      heading: "Do not measure bots by subtracting reports",
      blocks: [
        p(
          "A lower analytics number than the access log is not a bot count. The gap includes people who block tags, browsers that fail to load the script, cached pages, health checks, prefetch, and your own monitors. The known-bot exclusion removes another unknown amount. Publishing a percentage from that gap would be a guess.",
        ),
        p(
          "Compare like with like. If you want to know whether a new rate limit reduced signup posts, count POST /signup in the access log before and after, split by status code. If you want to know whether articles are being read in browsers that run your tag, use the analytics report and accept that known bots are already gone.",
        ),
      ],
    },
    {
      heading: "Patterns in the server log worth opening",
      blocks: [
        p(
          "These are reasons to look, not a signature of a bot. Confirm with more than one of them, and sample the requests before you block a range.",
        ),
        ul([
          "A high rate of requests to one path, with almost no requests for the CSS, JavaScript, and images that page references.",
          "POST requests to signup or login with no earlier GET of the form from that client.",
          "User agents that name an HTTP library, such as curl, python-requests, or Go-http-client. A browser-like agent does not clear the client.",
          "Many account creates from one IP or one network, or one account name tried from many IPs in a short window. The second pattern is common in [credential stuffing](/articles/credential-stuffing).",
          "A user agent that claims to be Googlebot or CCBot, while the source IP fails the operator's reverse-DNS or IP list. Both operators warn that the string can be copied.",
        ]),
        p(
          "Health checks and uptime monitors look similar to the first pattern. Exclude their addresses on purpose so a bot rule does not page you at 3 a.m. for your own probe.",
        ),
      ],
    },
    {
      heading: "Where a human verification result belongs",
      blocks: [
        p(
          "BotRepel does not send an analytics event and does not label a session inside Google Analytics. The result you can record is the one your server already has: siteverify returned success or a list of error codes. Log the path, the status, and the error code. Do not log the token, the secret key, or the camera frames. Frames from a light check are discarded by BotRepel after the request, which is covered in [what a check stores](/articles/human-verification-without-tracking).",
        ),
        p(
          `${PRICE_SENTENCE} A rise in timeout-or-duplicate errors means tokens are being reused or are arriving late. A rise in missing-input-response means the form is being posted without the widget. Those two codes are operational signals. They are not a count of humans.`,
        ),
        p(
          "If you need the check on the form in the first place, start with [blocking scrapers](/articles/block-bots-from-scraping) for public pages and [stopping fake signups](/articles/stop-fake-signups) for account creation. Filtering the analytics view does not refuse the request.",
        ),
      ],
    },
    {
      heading: "A small report that stays honest",
      blocks: [
        p(
          "Once a week, read three numbers from systems you control: requests to the public site, requests refused by the rate limit or the firewall, and form posts rejected by siteverify. Keep the definitions stable so the series means something next month. When a marketing report asks for a bot percentage, say which of those three numbers you have and which ones Analytics cannot show.",
        ),
      ],
    },
    {
      heading: "A log query you can repeat",
      blocks: [
        p(
          "Pick one line format and keep it. A useful signup line has the time, the path, the status, the client IP, and the siteverify error code or the word ok. It does not have the token, the password, or the secret. Count lines, not unique sessions. A client that posts fifty times is fifty attempts even if Analytics would have called it one user.",
        ),
        p(
          "Exclude health checks by a path you chose, such as /health, or by an address you configured on the probe. Write that exclusion next to the query so the next person does not delete it and rediscover the probe as an attack. Compare the week before a new limit with the week after, using the same query. A drop in 201 responses on POST /signup, with a rise in 403 and 429, is evidence about that endpoint. It is not evidence about article reads.",
        ),
        p(
          "If the analytics chart and the log disagree about a campaign, trust the log for requests that reached the server and trust Analytics for visits that executed the tag. Say both numbers in the report and label them. The [glossary](/articles/bot-protection-glossary) keeps the words stable: a crawler, a signup bot, and a person who blocks tags are not one bucket. Adding a human check does not rewrite historical Analytics rows. It changes the next form post, which you will see in the log first.",
        ),
        p(
          "Keep the query in the repo next to the dashboard screenshot you would otherwise paste into chat. A screenshot of a chart without the filter text cannot be rerun. Name the property, the date range in UTC, and the path. When someone asks for a percentage, answer with the three counts and the sentence that GA4 does not reveal how many known bots it dropped. That refusal is the accurate report. If a vendor offers to backfill the missing bot total, ask which list they used and whether you can export the raw rows. A number with no query behind it does not belong in the weekly note. Store the query next to the date you last ran it. A query that only lives in a browser tab will be lost the next time the tab closes. Commit it beside the dashboard notes. Run it every Monday in UTC so each week starts on the same boundary.",
        ),
      ],
    },
  ],
  faqs: [
    {
      question: "Can I see how much bot traffic GA4 removed?",
      answer:
        "Google says no. Known bot and spider traffic is excluded automatically, and the excluded volume is not shown. You also cannot turn the exclusion off.",
    },
    {
      question: "Should I delete suspicious users inside Analytics?",
      answer:
        "That edits the report. It does not stop the client from hitting the server. Block or rate-limit on the server, then let the report reflect the clients that remain.",
    },
  ],
  related: [
    "/articles/block-bots-from-scraping",
    "/articles/detect-headless-browsers",
    "/articles/credential-stuffing",
    "/articles/human-verification-without-tracking",
  ],
  sources: [
    {
      name: "Known bot-traffic exclusion, Google Analytics Help",
      href: "https://support.google.com/analytics/answer/9888366",
    },
    {
      name: "Google's common crawlers, updated 2026-10-30",
      href: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers",
    },
    { name: "CCBot, Common Crawl", href: "https://commoncrawl.org/ccbot" },
    { name: "BotRepel docs", href: "/docs" },
  ],
});

export const BLOCKING_ARTICLES: readonly Article[] = [blockBots, aiCrawlers, headless, analytics];
