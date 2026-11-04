import { Section } from "./Section";
import { buttonClassName } from "../components/Button";

const PRINCIPLES = [
  {
    name: "A live face, without a template",
    body: "The light check measures whether a live face is present. It does not recognize a person, build a template, or compare faces.",
  },
  {
    name: "Frames are discarded",
    body: "The light check uploads small, low-resolution face crops. They are analyzed during the request and then discarded. A few numeric scores are kept to tune accuracy.",
  },
  {
    name: "A different pseudonym per site",
    body: "A Human Pass gives each site its own pseudonym. Sites cannot match those values to each other. BotRepel keeps the link so it can act on abuse reports.",
  },
  {
    name: "Limited visitor records",
    body: "Visitor records do not include names, emails, selfies, or biometric templates.",
  },
] as const;

export function Privacy(): React.JSX.Element {
  return (
    <Section
      id="privacy"
      eyebrow="Privacy"
      title="What a check keeps"
      lede="The light check looks for a live face in front of the screen. Frames are analyzed in memory and discarded. The service does not build a face template."
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
