import { CopyButton } from "./CopyButton";
import { cn } from "../utils/cn";

const TEXT_STYLES = {
  code: "font-mono whitespace-pre-wrap wrap-anywhere text-fg-body",
  prose: "text-pretty wrap-anywhere text-fg-body",
  secret: "truncate font-mono text-fg",
} as const;

interface CopyFieldProps {
  readonly value: string;
  /** The accessible name of the copy button, e.g. "Copy secret key". */
  readonly label: string;
  /** `code` preserves whitespace and wraps; `prose` wraps text; `secret` stays on one line. */
  readonly kind?: keyof typeof TEXT_STYLES;
  readonly className?: string;
}

export function CopyField({ value, label, kind = "secret", className }: CopyFieldProps): React.JSX.Element {
  return (
    <CopyButton
      value={value}
      label={label}
      className={cn(
        "flex size-auto w-full min-w-0 items-start gap-2 border border-line-strong bg-surface-raised py-1.5 pr-1.5 pl-3 text-left hover:bg-white/8 [&>svg]:order-last [&>svg]:m-2 [&>svg]:shrink-0",
        className,
      )}
    >
      <span className={cn("min-w-0 flex-1 py-1 text-sm", TEXT_STYLES[kind])}>{value}</span>
    </CopyButton>
  );
}
