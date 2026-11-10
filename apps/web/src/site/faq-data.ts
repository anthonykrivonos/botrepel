import { FREE_CREDIT_MICROS, formatDollars } from "../shared/pricing";

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export const FAQ: readonly FaqItem[] = [
  {
    question: "Does BotRepel store faces?",
    answer:
      "No. The light check analyzes small, low-resolution frames in memory and discards them. We keep only numeric scores (such as how strongly the light correlated) to tune accuracy, never images or templates.",
  },
  {
    question: "Can a determined attacker still get through?",
    answer:
      "Yes. A person with a compromised device and a real-time relighting setup could pass a light check. The check raises the cost of mass signup fraud. It does not verify identity, and a targeted attack on one account can still succeed.",
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
      "The colors drift slowly and stay below the 3 Hz flash threshold in WCAG 2.3.1. Dark dips fade in and out. The widget explains the check before the camera starts, including a note for people who are sensitive to light.",
  },
];
