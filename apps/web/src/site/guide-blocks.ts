import type { Article, ArticleBlock, ArticleFigure } from "./article-types";
import { GUIDE_UPDATED } from "./guide-facts";

export function p(text: string): ArticleBlock {
  return { kind: "p", text };
}

export function ul(items: readonly string[]): ArticleBlock {
  return { kind: "ul", items };
}

export function ol(items: readonly string[]): ArticleBlock {
  return { kind: "ol", items };
}

export function code(title: string, source: string): ArticleBlock {
  return { kind: "code", title, code: source };
}

export function figure(figure: ArticleFigure): ArticleBlock {
  return { kind: "figure", figure };
}

/** In-article SVG. Width and height match the file so the layout does not shift. */
export function diagram(slug: string, alt: string, caption: string, height = 720): ArticleBlock {
  return figure({
    src: `/articles/${slug}.svg`,
    alt,
    width: 1200,
    height,
    caption,
  });
}

type ArticleBody = Omit<Article, "slug" | "path" | "updated" | "hub" | "ogImage">;

export function guideArticle(hub: string, slug: string, body: ArticleBody): Article {
  return {
    slug,
    path: `/articles/${slug}`,
    hub,
    updated: GUIDE_UPDATED,
    ogImage: `/articles/og/${slug}.png`,
    ...body,
  };
}
