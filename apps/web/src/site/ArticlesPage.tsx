import { ARTICLES } from "./articles";
import { pageByPath } from "./content";
import { HUBS, hubBySlug } from "./guides/hubs";
import { SiteFooter } from "./SiteFooter";
import { Nav } from "../components/Nav";

export function ArticlesPage(): React.JSX.Element {
  const page = pageByPath("/articles");
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-20 sm:px-6">
        <header className="flex flex-col gap-4">
          <h1 className="font-display text-display-sm font-normal">{page?.heading}</h1>
          <p className="text-lg text-fg-muted">{page?.description}</p>
          <p className="text-sm text-fg-subtle">
            <a href="/guides" className="underline underline-offset-4 hover:text-fg">
              Browse by guide
            </a>
          </p>
        </header>
        {HUBS.map((hub) => (
          <section key={hub.path} className="flex flex-col gap-4">
            <h2 className="text-xl">
              <a href={hub.path} className="underline-offset-4 hover:underline">
                {hub.heading}
              </a>
            </h2>
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {hub.slugs.map((slug) => {
                const article = ARTICLES.find((item) => item.slug === slug);
                if (!article) {
                  return null;
                }
                return (
                  <li key={article.path} className="py-5">
                    <a href={article.path} className="text-lg text-fg underline-offset-4 hover:underline">
                      {article.heading}
                    </a>
                    <p className="mt-2 text-sm text-fg-muted">{article.description}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}

export function GuidesPage(): React.JSX.Element {
  const page = pageByPath("/guides");
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
          <h1 className="font-display text-display-sm font-normal">{page?.heading}</h1>
          <p className="text-lg text-fg-muted">{page?.description}</p>
        </header>
        {HUBS.map((hub) => (
          <section key={hub.path} className="flex flex-col gap-3">
            <h2 className="text-xl">
              <a href={hub.path} className="underline-offset-4 hover:underline">
                {hub.heading}
              </a>
            </h2>
            {hub.intro.map((paragraph) => (
              <p key={paragraph} className="text-fg-body">
                {paragraph}
              </p>
            ))}
            <p className="text-sm text-fg-subtle">{hub.slugs.length} articles</p>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}

export function GuideHubPage({ hubSlug }: { readonly hubSlug: string }): React.JSX.Element {
  const hub = hubBySlug(hubSlug);
  if (!hub) {
    return <GuidesPage />;
  }
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-20 sm:px-6">
        <header className="flex flex-col gap-4">
          <p className="text-sm text-fg-subtle">
            <a href="/guides" className="underline underline-offset-4 hover:text-fg">
              Guides
            </a>
          </p>
          <h1 className="font-display text-display-sm font-normal">{hub.heading}</h1>
          {hub.intro.map((paragraph) => (
            <p key={paragraph} className="text-lg text-fg-muted">
              {paragraph}
            </p>
          ))}
        </header>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {hub.slugs.map((slug) => {
            const article = ARTICLES.find((item) => item.slug === slug);
            if (!article) {
              return null;
            }
            return (
              <li key={article.path} className="py-5">
                <a href={article.path} className="text-lg text-fg underline-offset-4 hover:underline">
                  {article.heading}
                </a>
                <p className="mt-2 text-sm text-fg-muted">{article.description}</p>
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
