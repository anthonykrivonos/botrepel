import { FigPow } from "./FigPow";
import { FigPseudonym } from "./FigPseudonym";
import { FigSchedule } from "./FigSchedule";
import { LayerRow } from "./LayerRow";
import { Section } from "./Section";
import { glassClassName } from "../components/Glass";
import { ASSURANCE_LABELS, type Assurance } from "../shared/assurance";

const POLICY: readonly { readonly action: string; readonly level: Assurance }[] = [
  { action: "signup", level: "invisible" },
  { action: "login", level: "invisible" },
  { action: "post", level: "presence" },
  { action: "vote", level: "presence" },
  { action: "payout", level: "liveness" },
];

export function Layers(): React.JSX.Element {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="Three checks, chosen per action"
      lede="Each action has a minimum check, and risk can only raise it for a visit."
    >
      <ol>
        <LayerRow
          index={1}
          name="Invisible check"
          title="The default check runs in the background"
          body="Each visit solves a small proof of work while the widget reads browser signals. A clean visit finishes without a prompt. A suspicious visit does more work or moves to a stronger check."
          facts={[
            "17 to 21 bits of work, scaled by risk.",
            "Signals can only raise the risk score.",
            "Work done outside the browser shows up as a hash rate browser JavaScript does not reach.",
          ]}
          caption="Difficulty and step-up by risk score"
          figure={<FigPow />}
        />
        <LayerRow
          index={2}
          flip
          name="Human Pass"
          title="A passkey after one light check"
          body="A person who passes a light check can save a passkey. Later checks can use Face ID, Touch ID, or another platform authenticator."
          facts={[
            "The unlock stays on the device. BotRepel does not ask for a name or an email.",
            "Each site receives a different pseudonym.",
            "A visitor can take a light check instead of using a pass.",
          ]}
          caption="One pass, unlinkable pseudonyms (illustrative values)"
          figure={<FigPseudonym />}
        />
        <LayerRow
          index={3}
          name="Flash liveness"
          title="A one-time color sequence"
          body="For higher-assurance actions, the screen shows a two-second color sequence. The check compares the light reflected from the face with that sequence, including timing."
          facts={[
            "The sequence is random, slow, and under 3 Hz.",
            "The check uses timing and how each region of the face reflects.",
            "Low-resolution frames are analyzed in memory and then discarded.",
          ]}
          caption="Sent light and its reflection (lag exaggerated)"
          figure={<FigSchedule />}
        />
      </ol>
      <div className={glassClassName("mt-6 grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:p-8")}>
        <div>
          <h3 className="mb-2 text-xl">Policies per action</h3>
          <p className="text-sm text-fg-muted">
            You set the minimum check for each form in the dashboard, and risk can raise that minimum for a visitor but
            can never lower it.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-fg-subtle">
            <tr className="border-b border-line">
              <th className="py-2 font-normal">Action</th>
              <th className="py-2 font-normal">Minimum check</th>
            </tr>
          </thead>
          <tbody>
            {POLICY.map(({ action, level }) => (
              <tr key={action} className="border-b border-line last:border-0">
                <td className="py-2.5 font-mono text-fg-body">{action}</td>
                <td className="py-2.5 text-fg">{ASSURANCE_LABELS[level]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
