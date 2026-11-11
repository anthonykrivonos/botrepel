/**
 * Writes the article diagrams to apps/web/public/articles/*.svg.
 * Rerun with: bun scripts/article-diagrams.ts
 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const WIDTH = 1200;
const HEIGHT = 720;

type Tone = "info" | "ok" | "warn" | "danger";

interface Box {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly title: string;
  readonly lines: readonly string[];
  readonly tone?: Tone;
}

interface Arrow {
  readonly from: string;
  readonly to: string;
}

const TONE: Record<Tone, string> = {
  info: "#70b8ff",
  ok: "#46fea5",
  warn: "#ffca16",
  danger: "#ff9592",
};

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function render(boxes: readonly Box[], arrows: readonly Arrow[]): string {
  const byId = new Map(boxes.map((box) => [box.id, box]));
  const arrowMarkup = arrows
    .map((arrow) => {
      const from = byId.get(arrow.from);
      const to = byId.get(arrow.to);
      if (!from || !to) {
        throw new Error(`Missing arrow ${arrow.from} -> ${arrow.to}`);
      }
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;
      const mid = (x1 + x2) / 2;
      return `<path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2 - 8} ${y2}" fill="none" stroke="#8a8f93" stroke-width="2" marker-end="url(#arrow)"/>`;
    })
    .join("");
  const boxMarkup = boxes
    .map((box) => {
      const accent = box.tone ? TONE[box.tone] : "rgba(255,255,255,0.14)";
      const lines = box.lines
        .map(
          (line, index) =>
            `<text x="${box.x + 20}" y="${box.y + 78 + index * 26}" fill="#b8bdc2" font-size="16" font-family="Inter, ui-sans-serif, sans-serif">${escapeXml(line)}</text>`,
        )
        .join("");
      return `<g>
        <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="12" fill="#111113" stroke="${accent}" stroke-width="${box.tone ? 2 : 1}"/>
        <text x="${box.x + 20}" y="${box.y + 40}" fill="#fcfcfd" font-size="22" font-family="Inter, ui-sans-serif, sans-serif">${escapeXml(box.title)}</text>
        ${lines}
      </g>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a8f93"/>
    </marker>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0a0a0c"/>
  ${arrowMarkup}
  ${boxMarkup}
</svg>
`;
}

function box(id: string, x: number, y: number, w: number, title: string, lines: readonly string[], tone?: Tone): Box {
  return { id, x, y, w, h: 64 + lines.length * 26 + 28, title, lines, tone };
}

const diagrams: Record<string, { boxes: Box[]; arrows: Arrow[] }> = {
  "block-bots-from-scraping": {
    boxes: [
      box("req", 40, 260, 200, "Client", ["Browser, crawler,", "or script"]),
      box("robots", 300, 80, 250, "robots.txt", ["A request to", "cooperating crawlers"], "warn"),
      box("edge", 620, 80, 250, "Edge limit", ["Rate limit or WAF", "on expensive paths"], "info"),
      box("page", 940, 40, 220, "Public page", ["HTML a browser", "can read"], "ok"),
      box("form", 300, 420, 280, "State-changing form", ["Signup, login, comment"], "info"),
      box("verify", 660, 400, 280, "siteverify", ["Token checked before", "the server writes"], "ok"),
    ],
    arrows: [
      { from: "req", to: "robots" },
      { from: "robots", to: "edge" },
      { from: "edge", to: "page" },
      { from: "req", to: "form" },
      { from: "form", to: "verify" },
    ],
  },
  "block-ai-crawlers": {
    boxes: [
      box("gpt", 40, 40, 360, "GPTBot", ["OpenAI training crawl.", "Disallow does not affect Google."], "warn"),
      box("search", 440, 40, 360, "OAI-SearchBot", ["ChatGPT search.", "Separate from GPTBot."], "ok"),
      box("claude", 840, 40, 320, "ClaudeBot", ["Anthropic training.", "One group per token."], "warn"),
      box("cc", 40, 280, 360, "CCBot", ["Common Crawl archive.", "Verify the IP, not the name."], "warn"),
      box(
        "ext",
        440,
        280,
        360,
        "Google-Extended",
        ["Gemini training and grounding.", "No separate HTTP user agent."],
        "info",
      ),
      box("bot", 840, 280, 320, "Googlebot", ["Google Search.", "Leave this group allowed."], "ok"),
    ],
    arrows: [],
  },
  "detect-headless-browsers": {
    boxes: [
      box("lib", 40, 240, 280, "HTTP library", ["No JavaScript.", "Fails a script challenge."], "danger"),
      box("head", 400, 80, 320, "Headless browser", ["Runs the page script.", "Can pass proof of work."], "warn"),
      box(
        "person",
        400,
        420,
        320,
        "Person in a browser",
        ["Same JavaScript engine.", "Signals can look unusual."],
        "ok",
      ),
      box("server", 820, 240, 330, "Your server", ["siteverify decides.", "A flag is only a clue."], "info"),
    ],
    arrows: [
      { from: "lib", to: "server" },
      { from: "head", to: "server" },
      { from: "person", to: "server" },
    ],
  },
  "filter-bot-traffic-analytics": {
    boxes: [
      box("hit", 40, 260, 240, "Request", ["Every client", "hits the server"]),
      box("log", 360, 80, 340, "Server log", ["Status, path, and", "siteverify error codes"], "info"),
      box("ga", 360, 420, 340, "GA4 report", ["Known bots already excluded.", "Excluded volume is hidden."], "warn"),
      box("gap", 800, 240, 340, "Do not subtract", ["The gap is not a", "bot percentage"], "danger"),
    ],
    arrows: [
      { from: "hit", to: "log" },
      { from: "hit", to: "ga" },
      { from: "log", to: "gap" },
      { from: "ga", to: "gap" },
    ],
  },
  "stop-fake-signups": {
    boxes: [
      box("post", 40, 260, 200, "POST /signup", ["Email and token"]),
      box("cheap", 300, 80, 280, "Cheap rejects", ["Bad fields, honeypot,", "or rate limit"], "warn"),
      box("sv", 300, 420, 280, "siteverify", ["Secret stays on", "the server"], "info"),
      box("row", 680, 250, 280, "Insert account", ["Only after success", "is true"], "ok"),
    ],
    arrows: [
      { from: "post", to: "cheap" },
      { from: "post", to: "sv" },
      { from: "sv", to: "row" },
    ],
  },
  "honeypot-fields": {
    boxes: [
      box("person", 40, 40, 320, "Person", ["Leaves company_website", "empty"], "ok"),
      box("simple", 40, 260, 320, "Simple bot", ["Fills every input", "it finds"], "danger"),
      box("auto", 40, 480, 320, "Browser bot", ["Skips the hidden field"], "warn"),
      box(
        "next",
        480,
        250,
        640,
        "Next check",
        ["Empty honeypot continues", "to siteverify. A filled", "field is rejected first."],
        "info",
      ),
    ],
    arrows: [
      { from: "person", to: "next" },
      { from: "simple", to: "next" },
      { from: "auto", to: "next" },
    ],
  },
  "rate-limit-signup-and-login": {
    boxes: [
      box("try", 40, 260, 220, "Login post", ["Email and password"]),
      box("ip", 330, 80, 280, "IP bucket", ["Short window for", "one address"], "warn"),
      box("acct", 330, 420, 280, "Account bucket", ["Tighter cap on", "one email"], "warn"),
      box("ok", 720, 250, 420, "Then verify", ["siteverify, then the", "password check"], "ok"),
    ],
    arrows: [
      { from: "try", to: "ip" },
      { from: "try", to: "acct" },
      { from: "ip", to: "ok" },
      { from: "acct", to: "ok" },
    ],
  },
  "credential-stuffing": {
    boxes: [
      box("list", 40, 260, 280, "Leaked pairs", ["Email and password", "from another site"], "danger"),
      box("many", 390, 80, 300, "Many IPs", ["Each address stays", "under a naive cap"], "warn"),
      box("token", 390, 420, 300, "This login", ["Fresh token required.", "Action is login."], "info"),
      box("mfa", 780, 250, 360, "Second factor", ["A correct password", "can still be stolen"], "ok"),
    ],
    arrows: [
      { from: "list", to: "many" },
      { from: "list", to: "token" },
      { from: "token", to: "mfa" },
    ],
  },
  "bot-protection-nextjs": {
    boxes: [
      box("client", 40, 240, 320, "Client component", ["use client.", "Widget action signup."], "info"),
      box("action", 440, 240, 320, "Server action", ["Reads botrepel-response.", "Secret is not NEXT_PUBLIC."], "warn"),
      box("db", 840, 240, 320, "Database", ["Insert only when", "success is true"], "ok"),
    ],
    arrows: [
      { from: "client", to: "action" },
      { from: "action", to: "db" },
    ],
  },
  "bot-protection-express": {
    boxes: [
      box("frame", 40, 240, 330, "Iframe widget", ["Parent stores the token", "after checking origin"], "info"),
      box("route", 450, 240, 330, "POST /signup", ["urlencoded body.", "verify() with the secret."], "warn"),
      box("user", 860, 240, 290, "Create user", ["403 when success", "is false"], "ok"),
    ],
    arrows: [
      { from: "frame", to: "route" },
      { from: "route", to: "user" },
    ],
  },
  "bot-protection-django": {
    boxes: [
      box("csrf", 40, 240, 300, "CSRF token", ["Still required.", "Not a human check."], "warn"),
      box("view", 410, 240, 340, "Django view", ["POST siteverify.", "Timeout of 5 seconds."], "info"),
      box("user", 830, 240, 320, "Create user", ["Pinned hostname", "example.com"], "ok"),
    ],
    arrows: [
      { from: "csrf", to: "view" },
      { from: "view", to: "user" },
    ],
  },
  "bot-protection-rails": {
    boxes: [
      box("auth", 40, 240, 320, "Authenticity token", ["protect_from_forgery", "stays on"], "warn"),
      box("ctrl", 430, 240, 330, "Controller", ["Net::HTTP to", "siteverify"], "info"),
      box("save", 840, 240, 310, "Save user", ["Redact the token", "in the logs"], "ok"),
    ],
    arrows: [
      { from: "auth", to: "ctrl" },
      { from: "ctrl", to: "save" },
    ],
  },
  "bot-protection-wordpress": {
    boxes: [
      box("cfg", 40, 240, 300, "wp-config.php", ["Secret constant.", "Not in the theme."], "warn"),
      box("form", 400, 80, 340, "Comment or register", ["Iframe in the form.", "Listener copies token."], "info"),
      box("php", 400, 420, 340, "wp_remote_post", ["Five-second timeout.", "Fails closed on error."], "info"),
      box("save", 820, 250, 330, "Then save", ["preprocess_comment or", "registration_errors"], "ok"),
    ],
    arrows: [
      { from: "cfg", to: "php" },
      { from: "form", to: "php" },
      { from: "php", to: "save" },
    ],
  },
  "captcha-alternatives": {
    boxes: [
      box("puzzle", 40, 180, 270, "Puzzle", ["Transcribe text", "or pick images"], "warn"),
      box("score", 340, 180, 270, "reCAPTCHA v3", ["Returns a score.", "No task for the visitor."], "info"),
      box("turn", 640, 180, 270, "Turnstile", ["Can run with no prompt.", "WCAG claim is Cloudflare's."], "info"),
      box("token", 940, 160, 220, "BotRepel", ["Token names invisible,", "presence, or liveness"], "ok"),
    ],
    arrows: [],
  },
  "bot-protection-glossary": {
    boxes: [
      box("client", 40, 80, 340, "Clients", ["Crawler, scraper,", "headless browser"], "info"),
      box("net", 430, 80, 340, "Server controls", ["robots.txt, WAF,", "rate limit, ASN"], "warn"),
      box("human", 820, 80, 340, "Human verification", ["Token, assurance,", "siteverify"], "ok"),
      box("acct", 40, 400, 540, "Account attacks", ["Fake signup, stuffing,", "spraying, brute force"], "danger"),
      box("not", 640, 400, 510, "Not identity", ["A passed check is not", "a document or a name"], "info"),
    ],
    arrows: [],
  },
};

const root = resolve(import.meta.dir, "../apps/web/public/articles");
await mkdir(root, { recursive: true });
for (const [slug, diagram] of Object.entries(diagrams)) {
  const path = resolve(root, `${slug}.svg`);
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, render(diagram.boxes, diagram.arrows));
}
console.info(`Wrote ${Object.keys(diagrams).length} diagrams to apps/web/public/articles`);
