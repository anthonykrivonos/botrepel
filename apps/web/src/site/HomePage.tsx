import { AgentEra } from "./AgentEra";
import { ClosingCta } from "./ClosingCta";
import { EvidenceBar } from "./EvidenceBar";
import { FactList } from "./FactList";
import { Faq } from "./Faq";
import { Hero } from "./Hero";
import { Integrate } from "./Integrate";
import { Layers } from "./Layers";
import { Pricing } from "./Pricing";
import { Privacy } from "./Privacy";
import { Research } from "./Research";
import { Section } from "./Section";
import { SiteFooter } from "./SiteFooter";
import { UseCases } from "./UseCases";
import { Nav } from "../components/Nav";

export function HomePage(): React.JSX.Element {
  return (
    <>
      <Nav />
      <main id="content">
        <Hero />
        <Layers />
        <UseCases />
        <Privacy />
        <Integrate />
        <AgentEra />
        <Research />
        <EvidenceBar />
        <Pricing />
        <Faq />
        <Section
          id="facts"
          title="The details are here when you need them"
          lede="Review the service’s prices, technical limits, and retention windows before you integrate."
        >
          <details className="group rounded-card border border-line-strong bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 text-fg [&::-webkit-details-marker]:hidden">
              <span>View prices, limits, and data retention</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4 shrink-0 transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m3 6 5 5 5-5" />
              </svg>
            </summary>
            <div className="px-4 pb-4 sm:px-6 sm:pb-6">
              <FactList />
            </div>
          </details>
        </Section>
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
