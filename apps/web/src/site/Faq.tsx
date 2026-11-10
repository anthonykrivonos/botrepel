import { FAQ } from "./faq-data";
import { Section } from "./Section";
import { CONTACT_EMAIL } from "../shared/constants";

export function Faq(): React.JSX.Element {
  return (
    <Section
      id="faq"
      eyebrow="FAQ"
      title="Common questions"
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
        {FAQ.map(({ question, answer }) => (
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
