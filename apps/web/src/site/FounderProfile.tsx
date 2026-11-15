import { CONTACT_EMAIL } from "../shared/constants";

export function FounderProfile(): React.JSX.Element {
  return (
    <section aria-labelledby="founder-heading" className="grid items-center gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-14">
      <img
        src="/images/anthony-krivonos.jpg"
        alt="Anthony Krivonos"
        width={768}
        height={1024}
        fetchPriority="high"
        decoding="async"
        className="aspect-[3/4] w-full max-w-sm rounded-dialog object-cover"
      />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-fg-muted">Founder</p>
          <h2 id="founder-heading" className="font-display text-[2.5rem] leading-tight font-normal text-balance">
            Anthony Krivonos
          </h2>
        </div>
        <div className="flex flex-col gap-4 text-fg-body">
          <p>Anthony is a software engineer and the founder of BotRepel.</p>
          <p>
            He co-founded{" "}
            <a
              href="https://www.ycombinator.com/companies/toma"
              className="underline underline-offset-4 transition-colors hover:text-fg"
            >
              Toma
            </a>
            , a voice AI company in Y Combinator’s Winter 2024 batch. Before Toma, he worked as an engineer at Scale AI
            and Lyft.
          </p>
          <p className="text-sm text-fg-muted">
            Read more about his background in{" "}
            <a
              href="https://www.finta.com/founders/toma"
              className="underline underline-offset-4 transition-colors hover:text-fg"
            >
              Finta’s founder interview
            </a>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <a
            href="https://www.anthonykrivonos.com/"
            className="text-fg-muted underline underline-offset-4 transition-colors hover:text-fg"
          >
            Personal website
          </a>
          <a
            href="https://www.linkedin.com/in/anthonykrivonos/"
            className="text-fg-muted underline underline-offset-4 transition-colors hover:text-fg"
          >
            LinkedIn
          </a>
          <a
            href="https://github.com/anthonykrivonos"
            className="text-fg-muted underline underline-offset-4 transition-colors hover:text-fg"
          >
            GitHub
          </a>
        </div>
        <div className="flex flex-col gap-2 border-t border-line-strong pt-6">
          <h3 className="text-base font-medium">Questions about BotRepel?</h3>
          <p className="text-sm text-fg-muted">
            Get in touch about integration, privacy, or which check fits your site.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="w-fit text-sm text-fg-muted underline underline-offset-4 transition-colors hover:text-fg"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  );
}
