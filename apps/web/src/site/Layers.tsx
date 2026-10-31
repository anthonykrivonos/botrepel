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
      title="One component, three layers"
      lede="Risk decides who sees a challenge, and your policy decides how strong it must be for each action."
    >
      <ol>
        <LayerRow
          index={1}
          name="Invisible check"
          title="Most people never see a thing"
          body="Every visit solves a small proof of work while the widget reads browser signals. Clean visits pass in the background, while suspicious ones do more work and step up."
          facts={[
            "17 to 21 bits of work, scaled by risk",
            "Signals can only add risk, and a bot can't lower its score by lying",
            "Work done off the browser (GPUs, native code) shows up as an impossible hash rate",
          ]}
          caption="Difficulty and step-up by risk score"
          figure={<FigPow />}
        />
        <LayerRow
          index={2}
          flip
          name="Human Pass"
          title="One tap, after the first check"
          body="People who pass a light check can save a passkey. From then on, Face ID, Touch ID, or a fingerprint proves a person is present on a real device."
          facts={[
            "No email, no account, no face leaves the device",
            "A different pseudonym on every site, so sites can't link a person",
            "Human Pass is optional, and visitors can always take a light check instead",
          ]}
          caption="One pass, unlinkable pseudonyms (illustrative values)"
          figure={<FigPseudonym />}
        />
        <LayerRow
          index={3}
          name="Flash liveness"
          title="Light can't be faked in time"
          body="For the actions that matter most, the screen shows a one-time color sequence for two seconds. A real face reflects it instantly, brighter where it faces the screen. Replays and deepfakes arrive late, flat, or wrong."
          facts={[
            "A new random sequence every time, slow and under 3 Hz, never a strobe",
            "Checks timing and how each region of the face reflects",
            "Low-resolution frames analyzed in memory, then discarded",
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
