import { FigAgentTrace } from "./FigAgentTrace";
import { Section } from "./Section";
import { glassClassName } from "../components/Glass";

const POINTS = [
  {
    title: "Agents get stepped up, not waved through",
    body: "An LLM driving a real browser can click any checkbox. It can't tap a passkey it doesn't hold, or put a live face in front of a screen that changes color on a schedule it has never seen.",
  },
  {
    title: "Automation leaves traces",
    body: "WebDriver flags, DevTools protocol hooks, headless quirks, and proof of work solved faster than any browser can each add risk. Together they trigger a check a script can't pass.",
  },
  {
    title: "Your agent joins the party",
    body: "Paste one prompt and your coding agent will read the install guide, run the CLI, and ask you to approve the sign-in. Your keys go in your env file and never appear in chat.",
  },
] as const;

export function AgentEra(): React.JSX.Element {
  return (
    <Section
      id="agents"
      eyebrow="Built for the agent era"
      title="Agents can solve puzzles, but they can't be people"
      lede="CAPTCHAs ask for skills software now has, while BotRepel asks for things only a present human has, like a device in hand and a face in the light."
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
