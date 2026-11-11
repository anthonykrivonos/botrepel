import { ArticleBlocks } from "./article-blocks";
import type { Article } from "./article-types";
import { articleByPath } from "./articles";
import { hubByPath, hubBySlug } from "./guides/hubs";
import { SiteFooter } from "./SiteFooter";
import { Nav } from "../components/Nav";

function formatUpdated(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}

function relatedLabel(href: string): string {
  const known: Readonly<Record<string, string>> = {
    "/docs": "Docs",
    "/about": "About",
    "/privacy": "Privacy policy",
    "/install.md": "Install guide",
    "/guides": "Guides",
  };
  return articleByPath(href)?.heading ?? hubByPath(href)?.heading ?? known[href] ?? href;
}

export function ArticlePage({ article }: { readonly article: Article }): React.JSX.Element {
  const hub = article.hub ? hubBySlug(article.hub) : undefined;
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-20 sm:px-6">
        <header className="flex flex-col gap-4">
          <p className="text-sm text-fg-subtle">
            <a href="/articles" className="underline underline-offset-4 hover:text-fg">
              Articles
            </a>
            {hub ? (
              <>
                {" / "}
                <a href={hub.path} className="underline underline-offset-4 hover:text-fg">
                  {hub.heading}
                </a>
              </>
            ) : null}
          </p>
          <h1 className="font-display text-display-sm font-normal">{article.heading}</h1>
          <p className="text-sm text-fg-subtle">By BotRepel. Updated {formatUpdated(article.updated)}.</p>
        </header>
        {article.summary ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl">Summary</h2>
            <p className="text-fg-body">{article.summary}</p>
          </section>
        ) : null}
        {article.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="text-xl">{section.heading}</h2>
            {section.blocks ? <ArticleBlocks blocks={section.blocks} /> : null}
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="text-fg-body">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        {article.howTo ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl">{article.howTo.name}</h2>
            <ol className="list-decimal space-y-3 pl-5 text-fg-body">
              {article.howTo.steps.map((step) => (
                <li key={step.name}>
                  <span className="text-fg">{step.name}.</span> {step.text}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {article.faqs && article.faqs.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl">Common questions</h2>
            {article.faqs.map((item) => (
              <div key={item.question} className="flex flex-col gap-2">
                <h3 className="text-base font-medium">{item.question}</h3>
                <p className="text-fg-body">{item.answer}</p>
              </div>
            ))}
          </section>
        ) : null}
        {article.related && article.related.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl">Related</h2>
            <ul className="flex flex-col gap-2">
              {article.related.map((href) => (
                <li key={href}>
                  <a href={href} className="text-fg-muted underline underline-offset-4 hover:text-fg">
                    {relatedLabel(href)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">Sources</h2>
          <ul className="flex flex-col gap-2">
            {article.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} className="text-fg-muted underline underline-offset-4 hover:text-fg">
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
