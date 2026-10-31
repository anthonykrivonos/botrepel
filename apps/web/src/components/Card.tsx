import { cn } from "../utils/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn("rounded-card p-6 border-gradient", className)} {...props} />;
}
