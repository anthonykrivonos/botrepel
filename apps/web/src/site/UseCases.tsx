import { Section } from "./Section";
import { USE_CASES } from "./useCaseData";
import { UseCaseDetails } from "./UseCaseDetails";
import { Button } from "../components/Button";
import { Glass } from "../components/Glass";
import { useSlideshow } from "../hooks/useSlideshow";

export function UseCases(): React.JSX.Element {
  const { ref, current, goTo } = useSlideshow(USE_CASES.length);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }
    const next =
      event.key === "ArrowRight"
        ? current + 1
        : event.key === "ArrowLeft"
          ? current - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? USE_CASES.length - 1
              : undefined;
    if (next !== undefined) {
      event.preventDefault();
      goTo(next);
    }
  };

  return (
    <Section
      id="use-cases"
      width="full"
      title="Stop abuse before it costs you"
      lede="Add human verification at the point where abuse becomes expensive."
      aside={
        <div className="flex items-center gap-3">
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mr-2 min-w-12 font-mono text-xs text-fg-subtle tabular-nums"
          >
            {current + 1} of {USE_CASES.length}
          </p>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous use case"
            disabled={current === 0}
            onClick={() => goTo(current - 1)}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next use case"
            disabled={current === USE_CASES.length - 1}
            onClick={() => goTo(current + 1)}
          >
            Next
          </Button>
        </div>
      }
    >
      <Glass className="mx-4 overflow-hidden p-0 sm:mx-6">
        <div
          ref={ref}
          role="region"
          aria-roledescription="carousel"
          aria-label="Use cases"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain focus-visible:outline-offset-[-4px] [&::-webkit-scrollbar]:hidden"
        >
          {USE_CASES.map((useCase, index) => (
            <article
              key={useCase.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${USE_CASES.length}: ${useCase.title}`}
              inert={index !== current}
              className="min-w-0 shrink-0 basis-full snap-start"
            >
              <UseCaseDetails useCase={useCase} active={index === current} />
            </article>
          ))}
        </div>
      </Glass>
    </Section>
  );
}
