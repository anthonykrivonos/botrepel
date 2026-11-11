import { LogoMark } from "../../components/LogoMark";
import { cn } from "../../utils/cn";

interface MiniSiteFrameProps {
  readonly address: string;
  readonly active: boolean;
  readonly outcome: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** A fictional website; its decorative verification sequence never makes a real request. */
export function MiniSiteFrame({
  address,
  active,
  outcome,
  className,
  children,
}: MiniSiteFrameProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "mini-site @container relative aspect-[4/3] w-full overflow-hidden rounded-card border border-white/15 bg-white leading-[1.3] text-slate-900 shadow-[0_12px_28px_-12px_rgb(0_0_0/0.5)]",
        className,
      )}
      data-active={active}
    >
      <div className="absolute inset-x-0 top-0 flex h-[9%] items-center gap-[2cqw] border-b border-current/10 bg-black/4 px-[3cqw]">
        <div className="flex gap-[1cqw]">
          <span className="size-[1.5cqw] rounded-full bg-[#ff6059]" />
          <span className="size-[1.5cqw] rounded-full bg-[#ffbd2e]" />
          <span className="size-[1.5cqw] rounded-full bg-[#28c840]" />
        </div>
        <span className="min-w-0 flex-1 truncate text-center font-sans text-[2cqw] opacity-75">{address}</span>
        <span className="w-[6cqw]" />
      </div>
      <div className="absolute inset-x-0 top-[9%] bottom-[22%] overflow-hidden">{children}</div>
      <div className="absolute inset-x-[5%] bottom-[6%] flex h-[13%] items-center gap-[2cqw] rounded-[1.5cqw] border border-slate-200 bg-white px-[2.5cqw] font-sans text-slate-900 shadow-[0_4px_12px_-6px_rgb(0_0_0/0.2)]">
        <LogoMark className="text-[3.6cqw] text-slate-900" />
        <div className="relative min-w-0 flex-1 text-[2.3cqw] font-medium">
          <span className="mini-site-before block">Ready to verify</span>
          <span className="mini-site-after absolute inset-0 text-emerald-700">Human verified</span>
        </div>
        <div className="mini-site-action relative flex h-[7cqw] w-[21cqw] shrink-0 items-center justify-center rounded-[1cqw] bg-slate-900 text-[2.2cqw] font-medium text-white">
          <span className="mini-site-before">Verify</span>
          <span className="mini-site-after absolute inset-0 flex items-center justify-center">Verified</span>
        </div>
      </div>
      <div className="mini-site-result absolute inset-x-[10%] top-[64%] flex items-center justify-center gap-[1.5cqw] rounded-[1.5cqw] border border-emerald-200 bg-emerald-50 px-[2cqw] py-[2cqw] font-sans text-[2.4cqw] font-medium text-emerald-900 shadow-[0_6px_18px_-8px_rgb(0_0_0/0.25)]">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-[3cqw] shrink-0">
          <path d="m3 8 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{outcome}</span>
      </div>
      <div className="mini-site-click pointer-events-none absolute top-[87%] left-[82%] size-[7cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/20" />
      <svg
        aria-hidden="true"
        className="mini-site-cursor pointer-events-none absolute h-[7cqw] w-[5cqw] overflow-visible drop-shadow-[0_2px_2px_rgb(0_0_0/0.35)]"
        viewBox="0 0 24 34"
        fill="#111"
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d="M2 2v25l6.4-6.1 4.5 10.7 4.5-1.9-4.6-10.5H22L2 2Z" />
      </svg>
    </div>
  );
}
