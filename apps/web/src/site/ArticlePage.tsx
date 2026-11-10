import type { Article } from "./articles";
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

export function ArticlePage({ article }: { readonly article: Article }): React.JSX.Element {
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-20 sm:px-6">
        <header className="flex flex-col gap-4">
          <p className="text-sm text-fg-subtle">
            <a href="/articles" className="underline underline-offset-4 hover:text-fg">
              Articles
            </a>
          </p>
          <h1 className="font-display text-display-sm font-normal">{article.heading}</h1>
          <p className="text-sm text-fg-subtle">Updated {formatUpdated(article.updated)}</p>
        </header>
        {article.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="text-xl">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-fg-body">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
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
