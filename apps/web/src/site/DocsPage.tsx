import { DOCS, type DocBlock } from "./docs";
import { SiteFooter } from "./SiteFooter";
import { CodeBlock } from "../components/CodeBlock";
import { Nav } from "../components/Nav";

function Block({ block }: { readonly block: DocBlock }): React.JSX.Element {
  if ("code" in block) {
    return <CodeBlock code={block.code} title={block.title} />;
  }
  if ("rows" in block) {
    return (
      <dl className="divide-y divide-line rounded-card border border-line">
        {block.rows.map(([term, description]) => (
          <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <dt className="font-mono text-[13px] break-words text-fg">{term}</dt>
            <dd className="text-sm text-fg-muted">{description}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <p className="text-fg-body">{block.text}</p>;
}

export function DocsPage(): React.JSX.Element {
  return (
    <>
      <Nav />
      <div className="mx-auto flex max-w-6xl gap-12 px-4 py-20 sm:px-6">
        <nav aria-label="Docs" className="sticky top-24 hidden h-fit w-48 shrink-0 lg:block">
          <ul className="flex flex-col gap-1 text-sm">
            {DOCS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="block py-1 text-fg-muted hover:text-fg">
                  {section.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex max-w-3xl min-w-0 flex-1 flex-col gap-16">
          <header className="flex flex-col gap-4">
            <h1 className="font-display text-display-sm font-normal">Docs</h1>
            <p className="text-lg text-fg-muted">
              Add BotRepel to a form, verify the token on your server, and choose how much proof each action needs.
            </p>
          </header>
          {DOCS.map((section) => (
            <section key={section.id} id={section.id} className="flex scroll-mt-24 flex-col gap-4">
              <h2 className="text-xl">{section.heading}</h2>
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </section>
          ))}
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
