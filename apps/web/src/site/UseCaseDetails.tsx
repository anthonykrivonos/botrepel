import type { UseCase } from "./useCaseData";
import { UseCasePreview } from "./UseCasePreview";

interface UseCaseDetailsProps {
  readonly useCase: UseCase;
  readonly active: boolean;
}

export function UseCaseDetails({ useCase, active }: UseCaseDetailsProps): React.JSX.Element {
  return (
    <div className="mx-auto grid h-full w-full max-w-6xl content-start gap-8 px-5 py-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-x-12 lg:gap-y-6 lg:px-10 lg:py-12">
      <div>
        <h3 className="mb-5 max-w-[20ch] font-display text-[2rem] leading-[1.08] font-normal tracking-[-0.02em] sm:text-[2.5rem]">
          {useCase.title}
        </h3>
        <p className="max-w-xl text-base text-fg-muted lg:text-lg">{useCase.description}</p>
      </div>
      <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
        <UseCasePreview useCase={useCase} active={active} />
      </div>
      <div className="flex min-w-0 flex-col lg:col-start-1">
        <dl>
          <dt className="mb-2 text-sm text-fg-subtle">Verify before</dt>
          <dd className="text-base text-fg">{useCase.verifyBefore}</dd>
        </dl>
        <div className="mt-8 flex flex-1 flex-col border-t border-line pt-6">
          {useCase.example && (
            <div className="mb-6">
              <p className="mb-2 text-sm text-fg-subtle">
                {useCase.example.label}
                <span aria-hidden="true" className="mx-2">
                  ·
                </span>
                <a
                  href={useCase.example.href}
                  className="text-fg-body underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-fg hover:decoration-fg-muted"
                >
                  {useCase.example.company}
                </a>
              </p>
              <p className="max-w-xl text-sm leading-relaxed text-fg-muted">{useCase.example.description}</p>
            </div>
          )}
          <a
            href="#integrate"
            className="mt-auto inline-flex min-h-11 items-center self-start text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-fg"
          >
            See Integration
          </a>
        </div>
      </div>
    </div>
  );
}
