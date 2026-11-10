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
import { RippleDots } from "../components/RippleDots";

export function HomePage(): React.JSX.Element {
  return (
    <>
      {/* The rippling dots behind every section give the glass panes something to frost. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <RippleDots />
      </div>
      <Nav />
      <main id="content">
        <Hero />
        <Section
          id="facts"
          eyebrow="Numbers"
          title="Figures the service uses"
          lede="Each figure below is a limit, a price, or a retention window from the running service."
        >
          <FactList />
        </Section>
        <UseCases />
        <EvidenceBar />
        <Layers />
        <Integrate />
        <AgentEra />
        <Privacy />
        <Research />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
