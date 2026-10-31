import { Section } from "./Section";
import { CONTACT_EMAIL } from "../shared/constants";
import { FREE_CREDIT_MICROS, formatDollars } from "../shared/pricing";

const QUESTIONS: readonly { readonly question: string; readonly answer: string }[] = [
  {
    question: "Does BotRepel store faces?",
    answer:
      "No. The light check analyzes small, low-resolution frames in memory and discards them. We keep only numeric scores (such as how strongly the light correlated) to tune accuracy, never images or templates.",
  },
  {
    question: "Can a determined attacker still get through?",
    answer:
      "Yes. Someone with a compromised device and a real-time, physically correct relighting rig could pass a light check. BotRepel makes each pass cost a live person or serious engineering, which breaks mass signup fraud. It isn't identity verification and doesn't claim to stop a funded attacker targeting one account.",
  },
  {
    question: "What does a visitor without a camera do?",
    answer:
      "Most visitors only ever see the invisible check. A Human Pass needs no camera after it's created. Set liveness only on actions where you want a live face every time.",
  },
  {
    question: "How is it billed?",
    answer: `Only when your server verifies a token, priced by the check it proved. New accounts get ${formatDollars(FREE_CREDIT_MICROS, 0)} of free usage. If credit runs out, you choose whether checks fall back to the invisible tier or fail closed.`,
  },
  {
    question: "Is it compatible with Turnstile or reCAPTCHA?",
    answer:
      "The siteverify endpoint uses Turnstile's field names, adding assurance, pseudonym, and unpaid. Moving over is mostly a new widget and a new URL.",
  },
  {
    question: "Is the color sequence safe for photosensitive people?",
    answer:
      "The colors drift slowly, below the 3 Hz flash threshold in WCAG 2.3.1, and the dark dips ramp rather than switch. The widget explains what will happen before the camera starts, with a note for anyone sensitive to light.",
  },
];

export function Faq(): React.JSX.Element {
  return (
    <Section
      id="faq"
      eyebrow="FAQ"
      title="Questions along the way"
      lede={
        <>
          Have another question? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-fg underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </>
      }
    >
      <div data-stagger className="divide-y divide-line border-y border-line">
        {QUESTIONS.map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-fg [&::-webkit-details-marker]:hidden">
              <span className="text-base font-medium">{question}</span>
              <span
                aria-hidden="true"
                className="text-xl leading-none text-fg-subtle transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="max-w-3xl pb-6 text-fg-muted">{answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
