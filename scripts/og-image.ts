/**
 * Renders the social preview (apps/web/public/og.png, 1200×630) with the site's own fonts and logo.
 * Rerun after changing the headline or the wordmark: bun run og:image
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { WORDMARK_HEART, WORDMARK_LETTERS } from "../apps/web/src/components/Logo";

const root = resolve(import.meta.dir, "..");
const fonts = `file://${root}/apps/web/public/fonts`;
// Letters in fg, the heart in the brand red (the `brand` token in styles.css).
const wordmark = `<svg viewBox="0 0 1377 155" height="32"><path d="${WORDMARK_LETTERS}" fill="#fcfcfd" fill-rule="evenodd"/><path d="${WORDMARK_HEART}" fill="#ff0000"/></svg>`;

const html = `<!doctype html><html><head><style>
@font-face { font-family: Inter; src: url("${fonts}/inter.woff2"); font-weight: 100 900; }
@font-face { font-family: "Instrument Serif"; src: url("${fonts}/instrument-serif.woff2"); }
@font-face { font-family: "Geist Mono"; src: url("${fonts}/geist-mono.woff2"); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #000; color: #fcfcfd; font-family: Inter; overflow: hidden;
  background-image: radial-gradient(60% 55% at 50% 0%, rgb(0 119 255 / 0.28) 0%, transparent 70%); }
main { position: absolute; inset: 72px 88px; display: flex; flex-direction: column; justify-content: space-between; }
.brand { display: flex; }
h1 { font-family: "Instrument Serif"; font-weight: 400; font-size: 112px; line-height: 0.98; letter-spacing: -0.025em; max-width: 900px; }
p { display: flex; justify-content: space-between; font-family: "Geist Mono"; font-size: 22px; color: #8a8f93; }
</style></head><body><main>
<div class="brand">${wordmark}</div>
<h1>Stop AI agents from abusing your site.</h1>
<p><span>Drop-in verification from $0.50 per 1,000 checks</span><span>botrepel.com</span></p>
</main></body></html>`;

const directory = await mkdtemp(join(tmpdir(), "og-"));
try {
  const file = join(directory, "og.html");
  await Bun.write(file, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, "apps/web/public/og.png") });
  await browser.close();
  console.info("Wrote apps/web/public/og.png");
} finally {
  await rm(directory, { recursive: true, force: true });
}
