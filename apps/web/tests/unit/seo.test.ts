import { describe, expect, test } from "bun:test";
import { pages } from "../../src/site/content";
import { installMarkdown } from "../../src/site/install";
import { discoveryFiles, renderHead, resolveSeoConfig } from "../../src/site/seo";

describe("resolveSeoConfig", () => {
  test("indexes only a production HTTPS origin", () => {
    expect(resolveSeoConfig({ SITE_URL: "https://botrepel.com" })).toEqual({
      origin: "https://botrepel.com",
      indexable: true,
    });
    expect(resolveSeoConfig({ SITE_URL: "https://botrepel.com", VERCEL_ENV: "preview" }).indexable).toBe(false);
    expect(resolveSeoConfig({ SITE_URL: "https://botrepel.com", SEO_NOINDEX: "1" }).indexable).toBe(false);
    expect(resolveSeoConfig({}).indexable).toBe(false);
  });

  test("rejects an origin with a path", () => {
    expect(() => resolveSeoConfig({ SITE_URL: "https://botrepel.com/app" })).toThrow();
  });
});

describe("discovery files", () => {
  test("a local build disallows crawling", () => {
    expect(discoveryFiles({ origin: "", indexable: false })["robots.txt"]).toContain("Disallow: /\n");
  });

  test("an indexable build lists its pages", () => {
    const files = discoveryFiles({ origin: "https://botrepel.com", indexable: true });
    expect(files["robots.txt"]).toContain("Sitemap: https://botrepel.com/sitemap.xml");
    expect(files["sitemap.xml"]).toContain("<loc>https://botrepel.com/</loc>");
  });

  test("the head escapes and canonicalizes", () => {
    const head = renderHead(pages[0]!, { origin: "https://botrepel.com", indexable: true });
    expect(head).toContain('<link rel="canonical" href="https://botrepel.com/">');
    expect(head).toContain('content="index, follow"');
    expect(head).toContain('<meta property="og:image" content="https://botrepel.com/og.png">');
    expect(head).toContain('content="summary_large_image"');
  });

  test("the legal pages are indexed", () => {
    const files = discoveryFiles({ origin: "https://botrepel.com", indexable: true });
    expect(files["sitemap.xml"]).toContain("<loc>https://botrepel.com/privacy</loc>");
    expect(files["sitemap.xml"]).toContain("<loc>https://botrepel.com/terms</loc>");
  });
});

describe("agent docs", () => {
  test("install.md pins the CLI version and points at this origin", () => {
    const files = discoveryFiles({ origin: "https://botrepel.com", indexable: true });
    expect(files["install.md"]).toMatch(/npx --yes botrepel@\d+\.\d+\.\d+ init/);
    expect(files["install.md"]).toContain("https://botrepel.com/dashboard");
    for (const section of [
      "### Better Auth",
      "### Auth.js (NextAuth)",
      "### Auth0",
      "### Clerk",
      "### Supabase Auth",
    ]) {
      expect(files["install.md"]).toContain(section);
    }
    expect(files["llms.txt"]).toContain("https://botrepel.com/install.md");
  });

  test("a local install.md uses the local CLI, tarball, and API origin", () => {
    const markdown = installMarkdown("http://localhost:3000", {
      pack: "bun run --cwd /repo pack:local",
      cli: "/repo/packages/botrepel/src/cli/bin.ts",
      tarball: "/repo/botrepel.tgz",
    });
    expect(markdown).toContain(
      "bun /repo/packages/botrepel/src/cli/bin.ts init --api http://localhost:3000 --no-install",
    );
    expect(markdown).toContain("npm install /repo/botrepel.tgz");
    expect(markdown).toContain('apiOrigin="http://localhost:3000"');
    expect(markdown).not.toContain("npx");
  });
});
