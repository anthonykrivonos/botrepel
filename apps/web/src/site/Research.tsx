import { Section } from "./Section";
import { buttonClassName } from "../components/Button";
import { glassClassName } from "../components/Glass";

const WHITEPAPER = "/research/botrepel-whitepaper";

const CONTENTS: readonly string[] = [
  "Why CAPTCHAs and passive scores stopped working",
  "The assurance ladder and per-action policy",
  "Proof of work as a meter, and risk signals that only add",
  "Human Pass: passkeys with unlinkable pseudonyms",
  "Flash liveness: the physics, the challenge, the decision",
  "Threat model, including the attacks we don't stop",
  "Privacy, law, pricing, and open questions",
];

export function Research(): React.JSX.Element {
  return (
    <Section
      id="research"
      eyebrow="Research"
      title="Read how it works, and where it stops."
      lede="The design, the evidence behind it, and an honest threat model, in an eight-page paper with sources."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <a
          href={`${WHITEPAPER}.pdf`}
          className={glassClassName("group flex flex-col justify-between gap-10 p-8 transition-colors duration-150")}
        >
          <div className="flex flex-col gap-4">
            <p className="font-mono text-xs text-fg-subtle">WHITEPAPER · OCTOBER 2026 · PDF</p>
            <h3 className="font-display text-[2rem] leading-tight font-normal">
              Proof of a present human on the open web
            </h3>
            <p className="text-sm text-fg-muted">
              CAPTCHAs no longer separate people from software. We describe a service between CAPTCHAs and identity
              verification: risk decides who is challenged, and each challenge asks for the cheapest proof the action
              needs.
            </p>
          </div>
          <span className="text-sm text-fg-muted transition-colors duration-150 group-hover:text-fg">
            Read the whitepaper <span aria-hidden="true">→</span>
          </span>
        </a>
        <div className="flex flex-col gap-6">
          <ol data-stagger className="flex flex-col divide-y divide-line border-y border-line">
            {CONTENTS.map((entry, index) => (
              <li key={entry} className="flex gap-4 py-3 text-sm text-fg-body">
                <span className="w-5 font-mono text-fg-subtle">{index + 1}</span>
                {entry}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <a href={`${WHITEPAPER}.pdf`} className={buttonClassName("secondary")}>
              Read the Whitepaper
            </a>
            <a href={`${WHITEPAPER}.tex`} download className={buttonClassName("ghost")}>
              LaTeX Source
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
