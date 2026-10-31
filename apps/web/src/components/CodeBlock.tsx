import { CopyButton } from "./CopyButton";
import { cn } from "../utils/cn";

interface CodeBlockProps {
  readonly code: string;
  /** Shown in the window bar, e.g. a file name. */
  readonly title?: string;
  readonly className?: string;
}

export function CodeBlock({ code, title, className }: CodeBlockProps): React.JSX.Element {
  return (
    <figure className={cn("overflow-hidden rounded-card border border-line bg-surface-raised", className)}>
      <figcaption className="flex h-10 items-center gap-3 border-b border-line pr-1 pl-4">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
        </span>
        <span className="flex-1 truncate font-mono text-xs text-fg-subtle">{title}</span>
        <CopyButton value={code} label={title ? `Copy ${title}` : "Copy code"} />
      </figcaption>
      {/* Focusable, so keyboard users can scroll a long line into view. */}
      <pre
        tabIndex={0}
        className="overflow-x-auto p-4 text-[13px] leading-6 text-fg-body focus-visible:outline-offset-[-2px]"
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}
