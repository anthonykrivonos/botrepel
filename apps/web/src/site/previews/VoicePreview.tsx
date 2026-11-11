import { MiniSiteFrame } from "./MiniSiteFrame";
import type { MiniSitePreviewProps } from "./previewTypes";

const CONTACTS = [
  { name: "Avery Lane", company: "North Studio", time: "09:30" },
  { name: "Jordan Kim", company: "Sunday Goods", time: "09:35" },
  { name: "Sam Rivera", company: "Fieldwork", time: "09:40" },
] as const;

export function VoicePreview({ active }: MiniSitePreviewProps): React.JSX.Element {
  return (
    <MiniSiteFrame
      address="blandish.example/campaigns"
      active={active}
      outcome="Call approved"
      className="bg-white text-[#151515]"
    >
      <div className="flex h-full flex-col font-sans leading-[1.3]">
        <div className="flex items-center gap-[4cqw] border-b border-[#eeeee8] px-[4cqw] py-[2.4cqw]">
          <span className="mr-[2cqw] text-[3.5cqw] leading-none font-extrabold tracking-[-0.04em]">Blandish AI</span>
          <span className="text-[1.9cqw] font-medium">Campaigns</span>
          <span className="text-[1.9cqw] text-[#737373]">Contacts</span>
          <span className="ml-auto bg-[#151515] px-[1.8cqw] py-[1cqw] text-[1.8cqw] font-medium text-white">
            Account
          </span>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_27%] gap-[4cqw] px-[4cqw] py-[3.5cqw]">
          <div className="flex min-w-0 flex-col">
            <span className="text-[4.2cqw] leading-[1.04] font-semibold tracking-[-0.02em]">Morning follow-ups</span>
            <span className="mt-[1.4cqw] text-[1.9cqw] text-[#737373]">Your next conversations</span>
            <div className="mt-[2.5cqw] flex min-h-0 flex-1 flex-col justify-between">
              {CONTACTS.map((contact, index) => (
                <div
                  key={contact.name}
                  className="flex items-center gap-[1.7cqw] border-t border-[#eeeee8] py-[1.6cqw]"
                >
                  <span className="flex size-[4.7cqw] shrink-0 items-center justify-center border border-[#ddddd5] bg-[#f6f6f1] text-[1.7cqw] text-[#4d4a41]">
                    {contact.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[0.3cqw]">
                    <span className="text-[2.1cqw] leading-tight">{contact.name}</span>
                    <span className="text-[1.6cqw] text-[#737373]">{contact.company}</span>
                  </div>
                  <span className="text-[1.7cqw] text-[#737373] tabular-nums">
                    {index === 0 ? "Next" : contact.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col border border-[#ddddd5] bg-[#f6f6f1] p-[2.4cqw]">
            <span className="text-[1.8cqw] text-[#737373]">Call budget</span>
            <span className="mt-[1.4cqw] text-[4.4cqw] leading-none font-semibold tracking-[-0.02em] tabular-nums">
              $24
            </span>
            <span className="mt-[1cqw] text-[1.7cqw] text-[#737373]">available</span>
            <div className="mt-auto flex flex-col gap-[1cqw] border-t border-[#ddddd5] pt-[2.4cqw]">
              <span className="text-[3.6cqw] leading-none font-semibold tabular-nums">3</span>
              <span className="text-[1.7cqw] text-[#737373]">calls queued</span>
            </div>
            <span className="mt-[2.4cqw] bg-[#f9a900] py-[1.4cqw] text-center text-[1.8cqw] font-medium">
              Start call
            </span>
          </div>
        </div>
      </div>
    </MiniSiteFrame>
  );
}
