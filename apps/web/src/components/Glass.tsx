import { cn } from "../utils/cn";

/** The class list for a frosted glass pane, for figures and links that look like one. */
export function glassClassName(className?: string): string {
  return cn("rounded-card border border-white/10 border-t-white/20 glass p-6", className);
}

/** A frosted glass panel for content that floats over imagery, glows, or the page's dot grid. */
export function Glass({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={glassClassName(className)} {...props} />;
}
