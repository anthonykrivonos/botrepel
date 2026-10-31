import { SITE_NAME } from "../shared/constants";
import { cn } from "../utils/cn";

/** The wordmark: BOTREPEL in pixel letters, one subpath per letter (counters cut by even-odd), the heart in the O. */
export const WORDMARK_LETTERS = [
  "M0 0H148V18H162V67H148V85H162V135H148V155H0V0ZM58 48H97V66H58V48ZM58 85H97V104H58V85Z",
  "M177 0H335V155H177V0Z",
  "M353 0H529V65H476V155H407V65H353V0Z",
  "M546 0H702V18H718V101H666V118H718V155H648V136H597V155H546V0ZM612 51H648V75H612V51Z",
  "M737 0H880V48H805V66H864V85H805V104H880V155H737V0Z",
  "M899 0H1056V97H1038V118H956V155H899V0ZM965 51H1005V75H965V51Z",
  "M1074 0H1217V48H1142V66H1201V85H1142V104H1217V155H1074V0Z",
  "M1235 0H1303V104H1377V155H1235V0Z",
].join("");
export const WORDMARK_HEART = "M226 47H246V67H266V47H286V87H266V107H246V87H226V47Z";

interface LogoProps {
  readonly className?: string;
}

/** Sized by font size: pass a text utility (`text-lg`) to scale it. Letters follow the current text color. */
export function Logo({ className }: LogoProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 1377 155"
      role="img"
      aria-label={SITE_NAME}
      className={cn("block h-[1em] w-auto shrink-0 text-fg", className)}
    >
      <path d={WORDMARK_LETTERS} fill="currentColor" fillRule="evenodd" />
      <path d={WORDMARK_HEART} className="fill-brand" />
    </svg>
  );
}
