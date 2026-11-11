import { MiniSiteFrame } from "./MiniSiteFrame";
import type { MiniSitePreviewProps } from "./previewTypes";

export function AgentSignupPreview({ active }: MiniSitePreviewProps): React.JSX.Element {
  return (
    <MiniSiteFrame
      address="uncommonpaper.example/onboarding"
      active={active}
      outcome="Account created"
      className="bg-[#f7f2ec] font-sans text-[#363839]"
    >
      <div className="h-full bg-[#08353f] px-[5cqw] py-[2.5cqw] leading-[1.35] text-white">
        <div className="flex items-center justify-between text-[2cqw]">
          <span className="text-[3.1cqw] leading-[1.05] font-semibold tracking-[-0.03em]">
            Uncommon
            <br />
            Paper
          </span>
          <div className="flex gap-[3cqw] font-medium">
            <span>Product</span>
            <span>Resources</span>
          </div>
          <span className="rounded-[0.8cqw] bg-white px-[2.5cqw] py-[1.2cqw] text-[#08353f]">Sign In</span>
        </div>

        <div className="mt-[3.5cqw] grid grid-cols-[1fr_1fr] items-start gap-[4cqw]">
          <div>
            <span className="block font-display text-[6.3cqw] leading-[1.05] font-normal tracking-[-0.02em]">
              A workspace for your contracts.
            </span>
            <p className="mt-[2.5cqw] text-[2.1cqw] leading-[1.5]">
              Your agent prepares the setup, and you confirm the account.
            </p>
          </div>

          <div className="rounded-[0.8cqw] bg-[#f7f2ec] p-[2.5cqw] text-[#363839]">
            <span className="text-[2.5cqw] font-semibold">Account setup</span>
            <p className="mt-[1.5cqw] font-mono text-[1.6cqw] leading-[1.5]">uncommonpaper onboard --agent</p>
            <div className="mt-[2.5cqw] flex flex-col gap-[2cqw] text-[1.9cqw] leading-[1.4]">
              <div className="flex items-start justify-between gap-[1.5cqw]">
                <span>Organization details</span>
                <span className="text-[#08353f]">Ready</span>
              </div>
              <div className="flex items-start justify-between gap-[1.5cqw]">
                <span>Contract workspace</span>
                <span className="text-[#08353f]">Ready</span>
              </div>
            </div>
            <div className="mt-[2.5cqw] border-t border-[#08353f]/15 pt-[2.5cqw]">
              <span className="text-[2.2cqw] font-semibold">Your approval is needed</span>
              <p className="mt-[1cqw] text-[1.9cqw] leading-[1.4]">Confirm before the account is created.</p>
            </div>
          </div>
        </div>
      </div>
    </MiniSiteFrame>
  );
}
