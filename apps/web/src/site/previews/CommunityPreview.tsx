import { MiniSiteFrame } from "./MiniSiteFrame";
import type { MiniSitePreviewProps } from "./previewTypes";

export function CommunityPreview({ active }: MiniSitePreviewProps): React.JSX.Element {
  return (
    <MiniSiteFrame
      address="subsnack.example/community"
      active={active}
      outcome="Post published"
      className="bg-[#161718] [font-family:system-ui,sans-serif] text-[#eeeeee]"
    >
      <div className="grid h-full grid-cols-[17%_minmax(0,1fr)_25%] gap-[3cqw] p-[3cqw] text-[2.1cqw] leading-[1.4]">
        <div>
          <span className="block text-[3cqw] font-bold tracking-[-0.03em] text-[#ff6719]">Subsnack</span>
          <div className="mt-[3.5cqw] flex flex-col gap-[1.3cqw] text-[#b6b6b6]">
            <span className="rounded-[2.4cqw] bg-white/10 px-[1.5cqw] py-[1.1cqw] font-semibold text-[#eeeeee]">
              Home
            </span>
            <span className="px-[1.5cqw] py-[1.1cqw]">Notes</span>
            <span className="px-[1.5cqw] py-[1.1cqw]">Chat</span>
            <span className="px-[1.5cqw] py-[1.1cqw]">Activity</span>
          </div>
          <span className="mt-[3cqw] block rounded-[1.6cqw] bg-[#ff6719] py-[1.3cqw] text-center font-semibold text-white">
            Create
          </span>
        </div>

        <div className="min-w-0">
          <span className="mb-[3cqw] block text-[#b6b6b6]">For you</span>
          <div className="border-b border-white/10 pb-[3cqw]">
            <div className="flex items-center gap-[1.5cqw]">
              <span className="flex size-[5.5cqw] shrink-0 items-center justify-center rounded-full bg-white/10 text-[1.8cqw] font-semibold">
                MK
              </span>
              <span className="font-semibold">Maya Kim</span>
              <span className="text-[1.8cqw] text-[#b6b6b6]">Draft</span>
            </div>
            <p className="mt-[2cqw] text-[2.3cqw] leading-[1.45]">Just finished my first ceramic collection.</p>
            <div className="mt-[2.5cqw] flex justify-end">
              <span className="rounded-[1.6cqw] bg-[#ff6719] px-[3cqw] py-[1.2cqw] text-[2cqw] font-semibold text-white">
                Post
              </span>
            </div>
          </div>
          <div className="pt-[3cqw]">
            <div className="flex items-center justify-between gap-[1cqw]">
              <span className="font-semibold">Amir Rahman</span>
              <span className="text-[1.8cqw] text-[#b6b6b6]">2h</span>
            </div>
            <p className="mt-[1cqw] text-[2.3cqw] leading-[1.45]">A new sketch, and a few ideas to explore.</p>
          </div>
        </div>

        <div>
          <div className="rounded-[1.6cqw] border border-white/10 bg-[#1b1c1d] px-[2cqw] py-[1.5cqw] text-[1.8cqw] text-[#b6b6b6]">
            Search Subsnack
          </div>
          <div className="mt-[2.5cqw] rounded-[2.4cqw] border border-white/10 bg-[#1b1c1d] px-[2cqw] py-[3cqw] text-center">
            <span className="text-[2.8cqw] leading-[1.2] font-semibold">The studio</span>
            <p className="mt-[1.5cqw] text-[1.9cqw] leading-[1.45] text-[#b6b6b6]">A little progress, every day.</p>
            <span className="mt-[3cqw] block rounded-[1.6cqw] bg-[#ff6719] py-[1.2cqw] text-[1.9cqw] font-semibold text-white">
              Subscribe
            </span>
          </div>
        </div>
      </div>
    </MiniSiteFrame>
  );
}
