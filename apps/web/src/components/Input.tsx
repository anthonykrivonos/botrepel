import { cn } from "../utils/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-fg transition-colors duration-150 placeholder:text-fg-subtle hover:border-white/20 focus-visible:border-info focus-visible:outline-none aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
