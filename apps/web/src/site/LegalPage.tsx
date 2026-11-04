import type { LegalDocument } from "./legal";
import { SiteFooter } from "./SiteFooter";
import { Nav } from "../components/Nav";

interface LegalPageProps {
  readonly document: LegalDocument;
}

export function LegalPage({ document }: LegalPageProps): React.JSX.Element {
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <p className="mb-4 text-sm text-fg-subtle">Last updated {document.updated}</p>
        <h1 className="mb-6 font-display text-display-sm font-normal">{document.title}</h1>
        <p className="mb-12 text-lg text-fg-muted">{document.intro}</p>
        <div className="flex flex-col gap-10">
          {document.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="text-xl">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-fg-body">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
