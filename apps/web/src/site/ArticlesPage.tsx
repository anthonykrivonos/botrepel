import { ARTICLES } from "./articles";
import { pageByPath } from "./content";
import { SiteFooter } from "./SiteFooter";
import { Nav } from "../components/Nav";

export function ArticlesPage(): React.JSX.Element {
  const page = pageByPath("/articles");
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-20 sm:px-6">
        <header className="flex flex-col gap-4">
          <h1 className="font-display text-display-sm font-normal">{page?.heading}</h1>
          <p className="text-lg text-fg-muted">{page?.description}</p>
        </header>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {ARTICLES.map((article) => (
            <li key={article.path} className="py-5">
              <a href={article.path} className="text-lg text-fg underline-offset-4 hover:underline">
                {article.heading}
              </a>
              <p className="mt-2 text-sm text-fg-muted">{article.description}</p>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
