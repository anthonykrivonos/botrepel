import { OPERATOR } from "./legal";
import { CONTACT_EMAIL } from "../shared/constants";

export function FounderNote(): React.JSX.Element {
  return (
    <section aria-label="The people behind BotRepel" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="grid gap-8 border-t border-line-strong pt-8 sm:grid-cols-2 sm:gap-16">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-medium">Built by Anthony Krivonos</h2>
          <p className="max-w-md text-sm text-fg-muted">
            BotRepel is an independent project operated by {OPERATOR}. You can read about the person building it and the
            company behind the service.
          </p>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="https://www.anthonykrivonos.com/" className="text-fg underline underline-offset-4">
              About Anthony
            </a>
            <a href="/about" className="text-fg underline underline-offset-4">
              About BotRepel
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-medium">Have a form in mind?</h2>
          <p className="max-w-md text-sm text-fg-muted">
            If you’re unsure which check fits, send a link and tell us where bots are getting through. Questions about
            integration and privacy are welcome too.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="mt-1 w-fit text-sm text-fg underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  );
}
