import { MiniSiteFrame } from "./MiniSiteFrame";
import type { MiniSitePreviewProps } from "./previewTypes";

export function AccountPreview({ active }: MiniSitePreviewProps): React.JSX.Element {
  return (
    <MiniSiteFrame
      name="Coinbaste"
      address="coinbaste.example/sign-in"
      active={active}
      outcome="Sign-in approved"
      className="bg-[#0a0b0d] text-white"
    >
      <div className="flex h-full flex-col font-sans leading-[1.3]">
        <div className="flex items-center px-[4cqw] py-[2.6cqw]">
          <span className="text-[3.6cqw] leading-none font-semibold tracking-[-0.04em]">Coinbaste</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center pb-[2cqw]">
          <div className="flex w-[57cqw] flex-col gap-[2cqw]">
            <span className="mb-[0.7cqw] text-[3.8cqw] leading-[1.2] font-semibold tracking-[-0.03em]">
              Sign in to Coinbaste
            </span>
            <span className="rounded-[1.2cqw] border border-[#578bfa] px-[2.4cqw] py-[2.3cqw] text-[2.2cqw] text-[#8a919e]">
              Email address
            </span>
            <span className="rounded-full bg-[#578bfa] py-[2.1cqw] text-center text-[2.2cqw] font-semibold text-[#0a0b0d]">
              Continue
            </span>
            <div className="my-[0.5cqw] flex items-center gap-[2cqw] text-[1.8cqw] text-[#8a919e]">
              <span className="h-px flex-1 bg-[#8a919e]/20" />
              <span>OR</span>
              <span className="h-px flex-1 bg-[#8a919e]/20" />
            </div>
            <span className="rounded-full border border-[#8a919e]/20 py-[2cqw] text-center text-[2.2cqw] font-semibold">
              Sign in with passkey
            </span>
            <span className="text-center text-[1.8cqw] text-[#578bfa]">Create an account</span>
          </div>
        </div>
      </div>
    </MiniSiteFrame>
  );
}
