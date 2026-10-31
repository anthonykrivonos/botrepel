import { cn } from "../utils/cn";

/** The mark: a pixel B drawn in the current text color, with the brand heart in its counter. */
export const MARK_LETTER = "M0 0H148V18H162V67H148V85H162V135H148V155H0V0Z";
export const MARK_HEART = "M47.5 48H67.5V68H87.5V48H107.5V88H87.5V108H67.5V88H47.5V48Z";

interface LogoMarkProps {
  readonly className?: string;
}

export function LogoMark({ className }: LogoMarkProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 162 155" aria-hidden="true" className={cn("block h-[1em] w-auto shrink-0", className)}>
      <path d={MARK_LETTER} fill="currentColor" />
      <path d={MARK_HEART} className="fill-brand" />
    </svg>
  );
}
