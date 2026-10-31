import { cn } from "../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-fg text-canvas hover:bg-fg/90",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-surface-raised",
  ghost: "text-fg-muted hover:bg-surface hover:text-fg",
  danger: "bg-danger-wash text-danger hover:bg-danger-wash/70",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

/** The class list for a button-styled element, for links that look like buttons. */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps): React.JSX.Element {
  return <button type={type} className={buttonClassName(variant, size, className)} {...props} />;
}
