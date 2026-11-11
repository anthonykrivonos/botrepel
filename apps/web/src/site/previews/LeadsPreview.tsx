import { MiniSiteFrame } from "./MiniSiteFrame";
import type { MiniSitePreviewProps } from "./previewTypes";

export function LeadsPreview({ active }: MiniSitePreviewProps): React.JSX.Element {
  return (
    <MiniSiteFrame
      address="posthogwash.example/contact"
      active={active}
      outcome="Inquiry sent"
      className="bg-[#eeefe9] font-[system-ui,sans-serif] text-[#23251d]"
    >
      <div className="flex h-full flex-col bg-[#66754e] leading-[1.3]">
        <div className="m-[1.5cqw] flex items-center justify-between rounded-[0.6cqw] bg-[#eeefe9] px-[2cqw] py-[1.5cqw]">
          <span className="text-[2.7cqw] font-bold tracking-[-0.03em]">PostHogwash</span>
          <div className="flex gap-[2.2cqw] text-[1.8cqw] font-medium">
            <span>Products</span>
            <span>Pricing</span>
            <span>Docs</span>
            <span>Company</span>
          </div>
          <span className="rounded-[0.8cqw] border border-[#b17816] bg-[#cd8407] px-[1.8cqw] py-[0.9cqw] text-[1.7cqw] font-semibold text-[#111]">
            Get Started
          </span>
        </div>
        <div className="relative flex min-h-0 flex-1 px-[4cqw] pb-[2cqw]">
          <div className="flex w-[19cqw] shrink-0 flex-col gap-[3.8cqw] pt-[3cqw] text-[1.9cqw] font-medium text-white">
            <span>Home</span>
            <span>Analytics</span>
            <span>Docs</span>
            <span>Talk to a human</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[1.5cqw] rounded-[2.5cqw] border border-[#bfc1b7] bg-[#eeefe9] px-[3cqw] py-[2cqw] shadow-[0_6px_15px_-8px_rgb(0_0_0/0.5)]">
            <div className="flex items-center justify-between text-[1.9cqw]">
              <span>
                <span className="font-semibold">To</span> sales@posthogwash.example
              </span>
              <span className="size-[1.5cqw] border-t border-[#73756b]" />
            </div>
            <div className="flex flex-col gap-[0.7cqw]">
              <span className="text-[1.9cqw] font-semibold">
                Your email<span className="text-[#f54e00]">*</span>
              </span>
              <span className="rounded-[0.65cqw] border border-[#bfc1b7] bg-[#fdfdf8] px-[1.8cqw] py-[1.2cqw] text-[2.1cqw] text-[#111]">
                alex@studio.example
              </span>
            </div>
            <div className="grid grid-cols-2 gap-[1.5cqw]">
              <div className="flex min-w-0 flex-col gap-[0.7cqw]">
                <span className="text-[1.9cqw] font-semibold">
                  Company<span className="text-[#f54e00]">*</span>
                </span>
                <span className="rounded-[0.65cqw] border border-[#bfc1b7] bg-[#fdfdf8] px-[1.8cqw] py-[1.2cqw] text-[2.1cqw] text-[#111]">
                  Studio
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-[0.7cqw]">
                <span className="text-[1.9cqw] font-semibold">
                  Role<span className="text-[#f54e00]">*</span>
                </span>
                <span className="rounded-[0.65cqw] border border-[#bfc1b7] bg-[#fdfdf8] px-[1.8cqw] py-[1.2cqw] text-[2.1cqw] text-[#111]">
                  Engineering
                </span>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-[0.7cqw]">
              <span className="text-[1.9cqw] font-semibold">What would you like to talk about?</span>
              <span className="flex-1 rounded-[0.65cqw] border border-[#bfc1b7] bg-[#fdfdf8] px-[1.8cqw] py-[1.2cqw] text-[2.1cqw] text-[#111]">
                Analytics for our new commerce experience.
              </span>
            </div>
          </div>
        </div>
      </div>
    </MiniSiteFrame>
  );
}
