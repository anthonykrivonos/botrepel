import { MiniSiteFrame } from "./MiniSiteFrame";
import type { MiniSitePreviewProps } from "./previewTypes";

export function CreditsPreview({ active }: MiniSitePreviewProps): React.JSX.Element {
  return (
    <MiniSiteFrame
      name="Replish"
      address="replish.example/workspace"
      active={active}
      outcome="100 credits unlocked"
      className="bg-[#faf6f1] text-[#37383c]"
    >
      <div className="flex h-full flex-col font-sans leading-[1.3]">
        <div className="flex items-center gap-[4cqw] px-[4cqw] py-[2.4cqw]">
          <span className="mr-[2cqw] text-[3.5cqw] leading-none font-semibold tracking-[-0.04em]">Replish</span>
          <span className="text-[1.8cqw]">Products</span>
          <span className="text-[1.8cqw]">Pricing</span>
          <span className="ml-auto rounded-[0.9cqw] bg-[#ec4e02] px-[2cqw] py-[1.2cqw] text-[1.8cqw] font-medium text-white">
            Free trial
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[11cqw] pb-[1.5cqw]">
          <span className="text-[5.7cqw] leading-none font-normal tracking-[-0.04em]">Start with an idea.</span>
          <span className="mt-[2cqw] text-[1.9cqw] text-[#5c5f66]">100 credits to build your first app</span>
          <div className="mt-[4cqw] flex w-full flex-col gap-[3.7cqw] rounded-[3cqw] border border-[#d2d0c9] bg-[#f2f1ef] px-[2.7cqw] py-[2.2cqw]">
            <span className="text-[2.2cqw] leading-[1.5]">Build a welcome page for our new members.</span>
            <div className="flex items-center justify-between text-[1.7cqw] text-[#5c5f66]">
              <span>App builder</span>
              <span className="rounded-full bg-[#ec4e02] px-[2.3cqw] py-[1cqw] font-medium text-white">Build</span>
            </div>
          </div>
          <div className="mt-[2.3cqw] flex gap-[1.3cqw] text-[1.7cqw]">
            {["Website", "Member portal", "Dashboard"].map((template) => (
              <span
                key={template}
                className="rounded-[0.9cqw] border border-[#d2d0c9] bg-[#eeece8] px-[1.5cqw] py-[0.8cqw]"
              >
                {template}
              </span>
            ))}
          </div>
        </div>
      </div>
    </MiniSiteFrame>
  );
}
