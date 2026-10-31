import { PRICE_MICROS } from "../shared/pricing";

const MIN = 0.1;
const MAX = 10_000;
const [LEFT, RIGHT] = [150, 562];
const x = (dollars: number): number =>
  LEFT + ((Math.log10(dollars) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN))) * (RIGHT - LEFT);
const perThousand = (micros: number): number => micros / 1000;

/** Dollars per 1,000 checks, log scale. Competitor ranges are published list prices (see the whitepaper). */
const ROWS = [
  { name: "CAPTCHA services", low: 0.99, high: 1, emphasis: false },
  {
    name: "BotRepel",
    low: perThousand(PRICE_MICROS.invisible),
    high: perThousand(PRICE_MICROS.liveness),
    emphasis: true,
  },
  { name: "Identity verification", low: 800, high: 1890, emphasis: false },
] as const;

const TICKS = [0.1, 1, 10, 100, 1000, 10_000];

export function PriceScale(): React.JSX.Element {
  return (
    <svg viewBox="0 0 600 150" role="img" aria-labelledby="price-scale-title" className="w-full text-[11px]">
      <title id="price-scale-title">
        Per 1,000 checks: CAPTCHA services about $1, BotRepel $0.50 to $20, identity verification $800 to $1,890.
      </title>
      {TICKS.map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1="8" y2="118" className="stroke-white/[0.06]" />
          <text x={x(tick)} y="136" textAnchor="middle" className="fill-fg-subtle font-mono">
            ${tick.toLocaleString("en-US")}
          </text>
        </g>
      ))}
      {ROWS.map((row, index) => {
        const top = 14 + index * 36;
        return (
          <g key={row.name}>
            <text x="0" y={top + 13} className={row.emphasis ? "fill-fg" : "fill-fg-muted"}>
              {row.name}
            </text>
            <rect
              x={x(row.low)}
              y={top}
              width={Math.max(6, x(row.high) - x(row.low))}
              height="18"
              rx="4"
              className={row.emphasis ? "fill-fg" : "fill-white/[0.16]"}
            />
          </g>
        );
      })}
    </svg>
  );
}
