import { cn } from "../utils/cn";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select
      className={cn(
        "h-10 rounded-control border border-line-strong bg-surface px-3 text-sm text-fg transition-colors duration-150 hover:border-white/20 focus-visible:border-info focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
