import { useRippleDots } from "../hooks/useRippleDots";
import { cn } from "../utils/cn";

/** Decorative dot field that ripples in the pointer's wake. Its positioned parent supplies the bounds. */
export function RippleDots({ className }: { readonly className?: string }): React.JSX.Element {
  const canvas = useRippleDots();
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 size-full text-fg", className)}
    />
  );
}
