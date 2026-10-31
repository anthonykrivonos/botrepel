import { useReveal } from "../hooks/useReveal";
import { cn } from "../utils/cn";

interface SectionProps {
  readonly id?: string;
  /** A short label above the title, e.g. "Pricing". */
  readonly eyebrow?: string;
  readonly title: React.ReactNode;
  readonly lede?: React.ReactNode;
  /** Sits to the right of the heading on wide screens: a badge or a link. */
  readonly aside?: React.ReactNode;
  /** Full-width content keeps the heading aligned with the rest of the page. */
  readonly width?: "contained" | "full";
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** A landing page section: a hairline above, eyebrow, serif title, lede, then content, revealed on scroll. */
export function Section({
  id,
  eyebrow,
  title,
  lede,
  aside,
  width = "contained",
  className,
  children,
}: SectionProps): React.JSX.Element {
  const ref = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      id={id}
      className={cn(
        "relative scroll-mt-20 py-24 sm:py-28",
        width === "full" ? "w-full" : "mx-auto max-w-6xl px-4 sm:px-6",
        "before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-white/12 before:to-transparent sm:before:inset-x-6",
        className,
      )}
    >
      <div
        className={cn(
          "mb-14 flex flex-wrap items-end justify-between gap-6",
          width === "full" && "mx-auto max-w-6xl px-4 sm:px-6",
        )}
      >
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="mb-5 flex items-center gap-3 font-mono text-xs tracking-[0.14em] text-fg-subtle uppercase">
              <span aria-hidden="true" className="h-px w-6 bg-line-strong" />
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-[2.5rem] leading-[1.05] font-normal tracking-[-0.02em] sm:text-[3rem]">
            {title}
          </h2>
          {lede && <p className="mt-4 text-lg text-fg-muted">{lede}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
