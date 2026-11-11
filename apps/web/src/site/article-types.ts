export interface ArticleSource {
  readonly name: string;
  readonly href: string;
}

export interface ArticleFigure {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly caption: string;
}

export type ArticleBlock =
  | { readonly kind: "p"; readonly text: string }
  | { readonly kind: "ul"; readonly items: readonly string[] }
  | { readonly kind: "ol"; readonly items: readonly string[] }
  | { readonly kind: "code"; readonly title: string; readonly code: string }
  | { readonly kind: "figure"; readonly figure: ArticleFigure };

export interface ArticleSection {
  readonly heading: string;
  /** Older articles are paragraphs only. */
  readonly paragraphs?: readonly string[];
  readonly blocks?: readonly ArticleBlock[];
}

export interface ArticleFaq {
  readonly question: string;
  readonly answer: string;
}

export interface HowToStep {
  readonly name: string;
  readonly text: string;
}

export interface ArticleHowTo {
  readonly name: string;
  readonly steps: readonly HowToStep[];
}

export interface Article {
  readonly slug: string;
  readonly path: string;
  /** Visible H1. For an article this is the article title. */
  readonly heading: string;
  /** Title-tag text before " | BotRepel". */
  readonly title: string;
  readonly description: string;
  /** Sitemap lastmod, YYYY-MM-DD. */
  readonly updated: string;
  /** Hub slug from `HUBS`, when the article belongs to a guide group. */
  readonly hub?: string;
  /** Direct answer, shown above the sections. */
  readonly summary?: string;
  readonly sections: readonly ArticleSection[];
  readonly sources: readonly ArticleSource[];
  readonly faqs?: readonly ArticleFaq[];
  readonly howTo?: ArticleHowTo;
  /** Other article or guide paths. */
  readonly related?: readonly string[];
  readonly ogImage?: string;
  readonly ogAlt?: string;
}
