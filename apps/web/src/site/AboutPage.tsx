import { pageByPath } from "./content";
import { FactList } from "./FactList";
import { OPERATOR, OPERATOR_ADDRESS } from "./legal";
import { SiteFooter } from "./SiteFooter";
import { Nav } from "../components/Nav";

export function AboutPage(): React.JSX.Element {
  const page = pageByPath("/about");
  return (
    <>
      <Nav />
      <main id="content" className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-20 sm:px-6">
        <header className="flex flex-col gap-4">
          <h1 className="font-display text-display-sm font-normal">{page?.heading}</h1>
          <p className="text-lg text-fg-muted">
            BotRepel is a human verification service that checks a person is present on a form, so a website can limit
            automated submissions. {OPERATOR} operates it from {OPERATOR_ADDRESS}.
          </p>
        </header>
        <section className="flex flex-col gap-4">
          <h2 className="text-xl">What a check can require</h2>
          <p className="text-fg-body">
            An invisible check is proof of work plus browser signals. A Human Pass is a passkey saved after one light
            check. A light check is a two-second color sequence and a head roll. The server verifies the resulting token
            once.
          </p>
          <p className="text-fg-body">
            Light-check frames are analyzed in memory and then discarded. Numeric scores, abuse reports, tokens, and
            rate-limit rows follow the retention windows below. The privacy policy states the same schedule.
          </p>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-xl">Prices and limits</h2>
          <FactList />
        </section>
        <p className="text-fg-body">
          Integration steps are in the <a href="/docs">docs</a>. Guides and comparisons are in{" "}
          <a href="/articles">articles</a>.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
