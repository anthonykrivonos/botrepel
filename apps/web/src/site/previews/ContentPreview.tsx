import { MiniSiteFrame } from "./MiniSiteFrame";
import type { MiniSitePreviewProps } from "./previewTypes";

export function ContentPreview({ active }: MiniSitePreviewProps): React.JSX.Element {
  return (
    <MiniSiteFrame
      name="Readit"
      address="readit.example/stories"
      active={active}
      outcome="Article unlocked"
      className="bg-white font-[system-ui,sans-serif] text-[#0f1a1c]"
    >
      <div className="flex h-full flex-col leading-[1.3]">
        <div className="border-b border-[#e2e7e9] px-[3cqw] py-[2cqw]">
          <span className="text-[4.5cqw] leading-none font-bold tracking-[-0.04em] text-[#ff4500]">readit</span>
        </div>
        <div className="mx-auto flex w-[72%] flex-1 flex-col items-center justify-center gap-[3cqw] py-[4cqw] text-center">
          <span className="text-[4.4cqw] leading-tight font-bold">Verify to keep reading</span>
          <span className="max-w-[58cqw] text-[2.5cqw] leading-snug text-[#2a3c42]">
            Complete the check below to open this story and join the conversation.
          </span>
          <div className="w-full border-t border-[#e2e7e9] pt-[3cqw]">
            <span className="block text-[1.8cqw] text-[#576f76]">r/SmallCommunities · 6 min read</span>
            <span className="mt-[1.2cqw] block text-[2.9cqw] font-semibold">The internet is still a human place.</span>
          </div>
        </div>
      </div>
    </MiniSiteFrame>
  );
}
