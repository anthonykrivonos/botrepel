import { MiniSiteFrame } from "./MiniSiteFrame";
import type { MiniSitePreviewProps } from "./previewTypes";

export function MarketplacePreview({ active }: MiniSitePreviewProps): React.JSX.Element {
  return (
    <MiniSiteFrame
      address="instacartoon.example/checkout"
      active={active}
      outcome="Offer claimed"
      className="bg-white font-sans text-[#242529]"
    >
      <div className="flex h-full flex-col leading-[1.3]">
        <div className="flex items-center gap-[3cqw] bg-[#f6f4ee] px-[3.5cqw] py-[2.2cqw]">
          <span className="text-[3.8cqw] leading-none font-bold tracking-[-0.035em] text-[#003d29]">instacartoon</span>
          <span className="flex-1 rounded-full border border-[#c7c8cd] bg-[#f6f7f8] px-[2.5cqw] py-[1.3cqw] text-[1.8cqw] font-semibold">
            Search products and stores
          </span>
          <span className="rounded-full bg-[#108910] px-[2.5cqw] py-[1.3cqw] text-[1.8cqw] font-semibold text-white">
            Cart · 8
          </span>
        </div>
        <div className="flex items-center justify-between bg-[#003d29] px-[4cqw] py-[3cqw] text-white">
          <div className="flex flex-col gap-[0.8cqw]">
            <span className="text-[4.1cqw] leading-tight font-semibold">Your weekend basket</span>
            <span className="text-[2cqw]">Fresh finds, delivered Saturday</span>
          </div>
          <span className="rounded-full bg-[#108910] px-[3cqw] py-[1.5cqw] text-[2.1cqw] font-semibold">
            20% off your first basket
          </span>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] gap-[4cqw] px-[4cqw] pt-[3cqw]">
          <div className="flex min-w-0 flex-col gap-[2.2cqw]">
            <span className="text-[3.5cqw] font-bold">Your items</span>
            <div className="flex items-center justify-between border-b border-[#e8e9eb] pb-[1.5cqw] text-[2.2cqw]">
              <div className="flex flex-col gap-[0.5cqw]">
                <span className="font-semibold">Seasonal fruit & greens</span>
                <span className="text-[1.9cqw] text-[#343538]">5 items</span>
              </div>
              <span>$26.50</span>
            </div>
            <div className="flex items-center justify-between text-[2.2cqw]">
              <div className="flex flex-col gap-[0.5cqw]">
                <span className="font-semibold">Pantry favorites</span>
                <span className="text-[1.9cqw] text-[#343538]">3 items</span>
              </div>
              <span>$16.00</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-[1.8cqw] rounded-[1.5cqw] border border-[#e8e9eb] p-[2.5cqw]">
            <span className="text-[2.3cqw] font-bold">Delivery details</span>
            <span className="text-[2cqw] text-[#343538]">Saturday, 9–11 AM</span>
            <span className="rounded-[1cqw] bg-[#f6f7f8] px-[1.8cqw] py-[1.2cqw] text-[1.9cqw] font-semibold text-[#108910]">
              Offer code: WEEKEND20
            </span>
            <div className="mt-auto flex items-baseline justify-between border-t border-[#e8e9eb] pt-[1.5cqw] font-semibold">
              <span className="text-[2.2cqw]">Subtotal</span>
              <span className="text-[3.4cqw]">$42.50</span>
            </div>
          </div>
        </div>
      </div>
    </MiniSiteFrame>
  );
}
