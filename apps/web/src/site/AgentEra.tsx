import { FigAgentTrace } from "./FigAgentTrace";
import { Section } from "./Section";
import { glassClassName } from "../components/Glass";

const POINTS = [
  {
    title: "Automation signals raise the check",
    body: "WebDriver, headless browser behavior, and proof of work solved faster than browser JavaScript each add risk. The site policy sets the minimum, and risk can only raise it.",
  },
  {
    title: "A passkey stays on the device",
    body: "After one light check, a person can save a Human Pass. Later visits can use that passkey. BotRepel stores the public key and a different pseudonym on each site.",
  },
  {
    title: "A coding agent can install it",
    body: "The install guide lists the commands and the files to edit. The CLI writes the keys to the env file. The secret is not included in the guide.",
  },
] as const;

export function AgentEra(): React.JSX.Element {
  return (
    <Section
      id="agents"
      eyebrow="Automation"
      title="Signals, a passkey, or a live face"
      lede="A clean browser completes a proof of work in the background. Automation signals can raise that visit to a passkey or a camera sequence."
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <ul data-stagger className="flex flex-col">
          {POINTS.map((point) => (
            <li key={point.title} className="border-t border-line py-6 first:border-0 first:pt-0">
              <h3 className="mb-2 text-base">{point.title}</h3>
              <p className="text-sm text-fg-muted">{point.body}</p>
            </li>
          ))}
        </ul>
        <figure className={glassClassName("p-5 sm:p-6")}>
          <FigAgentTrace />
          <figcaption className="mt-4 border-t border-line pt-4 font-mono text-[11px] text-fg-subtle">
            FIG. 4 · An agent meets the widget (real weights and thresholds)
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}
