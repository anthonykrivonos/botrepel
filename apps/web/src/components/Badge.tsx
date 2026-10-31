import { cn } from "../utils/cn";

export type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-white/6 text-fg-muted",
  ok: "bg-ok-wash text-ok",
  warn: "bg-warn-wash text-warn",
  danger: "bg-danger-wash text-danger",
  info: "bg-info-wash text-info",
};

interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly children: React.ReactNode;
}

/** Color means state: passed, pending, failed, informational. */
export function Badge({ tone = "neutral", children }: BadgeProps): React.JSX.Element {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", TONES[tone])}>
      {children}
    </span>
  );
}
