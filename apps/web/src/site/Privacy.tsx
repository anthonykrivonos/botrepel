import { Section } from "./Section";
import { buttonClassName } from "../components/Button";

const PRINCIPLES = [
  {
    name: "Liveness, not identity",
    body: "We check that a live face is present. We never recognize one, build a template, or compare faces.",
  },
  {
    name: "In memory, then gone",
    body: "The light check uploads small, low-resolution face crops that are analyzed during the request and then discarded, while only a few numeric scores are kept to tune accuracy.",
  },
  {
    name: "Unlinkable across sites",
    body: "A Human Pass gives each site its own pseudonym, so sites can't follow a person from one to the next. BotRepel keeps the link only to act on abuse reports.",
  },
  {
    name: "Nothing to breach",
    body: "No IDs, selfies, emails, or biometric templates are stored for visitors, so there's nothing sensitive to leak.",
  },
] as const;

export function Privacy(): React.JSX.Element {
  return (
    <Section
      id="privacy"
      eyebrow="Privacy by architecture"
      title="Proving you're human shouldn't cost your face"
      lede="Identity checks collect documents and selfies. BotRepel answers a smaller question, so it can keep almost nothing."
      aside={
        <a href="/privacy" className={buttonClassName("secondary")}>
          Read the Privacy Policy
        </a>
      }
    >
      <ol data-stagger className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
        {PRINCIPLES.map((principle, index) => (
          <li key={principle.name} className="flex flex-col gap-2 bg-canvas p-6 lg:p-8">
            <span className="font-mono text-xs text-fg-subtle">0{index + 1}</span>
            <h3 className="text-base">{principle.name}</h3>
            <p className="text-sm text-fg-muted">{principle.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
