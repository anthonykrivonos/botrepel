/**
 * Social images for guides and articles (1200×630). Rerun after a title change:
 * bun scripts/article-og.ts
 */
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { WORDMARK_HEART, WORDMARK_LETTERS } from "../apps/web/src/components/Logo";
import { ARTICLES } from "../apps/web/src/site/articles";
import { HUBS } from "../apps/web/src/site/guides/hubs";

const root = resolve(import.meta.dir, "..");
const fonts = `file://${root}/apps/web/public/fonts`;
const wordmark = `<svg viewBox="0 0 1377 155" height="28"><path d="${WORDMARK_LETTERS}" fill="#fcfcfd" fill-rule="evenodd"/><path d="${WORDMARK_HEART}" fill="#ff0000"/></svg>`;

interface Card {
  readonly file: string;
  readonly heading: string;
}

const cards: Card[] = [
  { file: "apps/web/public/articles/og/guides.png", heading: "Guides" },
  ...HUBS.map((hub) => ({ file: `apps/web/public${hub.ogImage}`, heading: hub.heading })),
  ...ARTICLES.flatMap((article) =>
    article.ogImage ? [{ file: `apps/web/public${article.ogImage}`, heading: article.heading }] : [],
  ),
];

function page(heading: string): string {
  const size = heading.length > 48 ? 54 : heading.length > 32 ? 68 : 84;
  return `<!doctype html><html><head><style>
@font-face { font-family: Inter; src: url("${fonts}/inter.woff2"); font-weight: 100 900; }
@font-face { font-family: "Instrument Serif"; src: url("${fonts}/instrument-serif.woff2"); }
@font-face { font-family: "Geist Mono"; src: url("${fonts}/geist-mono.woff2"); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #000; color: #fcfcfd; font-family: Inter; overflow: hidden;
  background-image: radial-gradient(60% 55% at 50% 0%, rgb(0 119 255 / 0.28) 0%, transparent 70%); }
main { position: absolute; inset: 64px 80px; display: flex; flex-direction: column; justify-content: space-between; }
h1 { font-family: "Instrument Serif"; font-weight: 400; font-size: ${size}px; line-height: 1.02; letter-spacing: -0.02em; max-width: 1000px; }
p { font-family: "Geist Mono"; font-size: 22px; color: #8a8f93; }
</style></head><body><main>
<div>${wordmark}</div>
<h1>${heading.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</h1>
<p>botrepel.com</p>
</main></body></html>`;
}

const directory = await mkdtemp(join(tmpdir(), "article-og-"));
try {
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const card of cards) {
    const htmlPath = join(directory, "card.html");
    await Bun.write(htmlPath, page(card.heading));
    await tab.goto(`file://${htmlPath}`);
    await tab.evaluate(() => document.fonts.ready);
    const target = join(root, card.file);
    await mkdir(join(target, ".."), { recursive: true });
    await tab.screenshot({ path: target, type: "png" });
  }
  await browser.close();
  console.info(`Wrote ${cards.length} social images`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
