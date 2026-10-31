import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

const COPIED_MS = 1600;

interface CopyButtonProps {
  readonly value: string;
  readonly label?: string;
  readonly className?: string;
  /** Visible text beside the icon; without it the button is icon-only. */
  readonly children?: React.ReactNode;
}

export function CopyButton({ value, label, className, children }: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? "Copied" : (label ?? (children ? undefined : "Copy"))}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-control text-fg-subtle transition-colors duration-150 hover:bg-white/6 hover:text-fg",
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {copied ? (
          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="5.25" y="5.25" width="8" height="8" rx="1.5" />
            <path d="M10.75 3.25v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
          </>
        )}
      </svg>
      {children}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
