import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { App } from "../../src/App";
import type { Article, ArticleBlock } from "../../src/site/article-types";
import { ARTICLES } from "../../src/site/articles";
import { pages } from "../../src/site/content";
import { HUBS } from "../../src/site/guides/hubs";
import { renderHead, type SeoConfig } from "../../src/site/seo";

const config: SeoConfig = { origin: "https://botrepel.com", indexable: true };
const publicRoot = resolve(import.meta.dir, "../../public");

function blockText(block: ArticleBlock): string[] {
  if (block.kind === "p") {
    return [block.text];
  }
  if (block.kind === "ul" || block.kind === "ol") {
    return [...block.items];
  }
  if (block.kind === "figure") {
    return [block.figure.caption];
  }
  return [];
}

/** Visible prose, with markdown links counted as their labels. Code samples are not prose. */
export function articleWords(article: Article): number {
  const chunks = [
    article.summary ?? "",
    ...article.sections.flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.blocks ?? []).flatMap(blockText),
    ]),
    ...(article.faqs ?? []).flatMap((item) => [item.question, item.answer]),
    ...(article.howTo ? [article.howTo.name, ...article.howTo.steps.flatMap((step) => [step.name, step.text])] : []),
  ];
  return chunks
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .split(/\s+/)
    .filter(Boolean).length;
}

describe("guide articles", () => {
  const guides = ARTICLES.filter((article) => article.updated === "2026-11-11");

  test("each new guide is a full page with one diagram and its own social image", () => {
    expect(guides.length).toBeGreaterThanOrEqual(12);
    for (const article of guides) {
      const count = articleWords(article);
      expect(count, article.slug).toBeGreaterThanOrEqual(1200);
      expect(count, article.slug).toBeLessThanOrEqual(2500);
      const text = JSON.stringify(article);
      expect(text.includes("—") || text.includes("–"), article.slug).toBe(false);
      expect(text.toLowerCase().includes("not just"), article.slug).toBe(false);
      expect(text.toLowerCase().includes("not only"), article.slug).toBe(false);
      const figures = article.sections
        .flatMap((section) => section.blocks ?? [])
        .filter((block) => block.kind === "figure");
      expect(figures.length, article.slug).toBeGreaterThan(0);
      for (const figure of figures) {
        if (figure.kind !== "figure") {
          continue;
        }
        expect(figure.figure.width, article.slug).toBeGreaterThan(0);
        expect(figure.figure.height, article.slug).toBeGreaterThan(0);
        expect(figure.figure.alt.length, article.slug).toBeGreaterThan(20);
        expect(existsSync(resolve(publicRoot, figure.figure.src.slice(1))), figure.figure.src).toBe(true);
      }
      expect(article.ogImage, article.slug).toBe(`/articles/og/${article.slug}.png`);
      expect(existsSync(resolve(publicRoot, `articles/og/${article.slug}.png`)), article.slug).toBe(true);
      const page = pages.find((item) => item.path === article.path);
      const head = renderHead(page!, config);
      expect(head, article.slug).toContain(`https://botrepel.com/articles/og/${article.slug}.png`);
      const html = renderToString(createElement(App, { path: article.path }));
      expect(html, article.slug).toContain('loading="lazy"');
      expect(html, article.slug).toContain('width="1200"');
      expect(html, article.slug).toContain('height="720"');
    }
  });

  test("hubs list every article once and link from the guides index", () => {
    const slugs = HUBS.flatMap((hub) => hub.slugs);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.toSorted()).toEqual(ARTICLES.map((article) => article.slug).toSorted());
    const html = renderToString(createElement(App, { path: "/guides" }));
    for (const hub of HUBS) {
      expect(html).toContain(`href="${hub.path}"`);
      expect(existsSync(resolve(publicRoot, hub.ogImage.slice(1))), hub.ogImage).toBe(true);
    }
    const articles = renderToString(createElement(App, { path: "/articles" }));
    expect(articles).toContain('href="/guides"');
    for (const article of ARTICLES) {
      expect(articles, article.path).toContain(`href="${article.path}"`);
    }
  });
});
