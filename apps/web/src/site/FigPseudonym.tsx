const SITES = [
  { site: "shop.example", pseudonym: "8f2c…a91" },
  { site: "forum.example", pseudonym: "c41e…07d" },
  { site: "bank.example", pseudonym: "5b9a…e3f" },
] as const;

/** One passkey, a different pseudonym per site: illustrative values, real derivation (HMAC per site). */
export function FigPseudonym(): React.JSX.Element {
  return (
    <svg viewBox="0 0 400 230" role="img" aria-labelledby="fig-pass-title" className="w-full font-mono text-[10px]">
      <title id="fig-pass-title">
        One Human Pass gives each site a different pseudonym, so sites can't link a person.
      </title>
      <rect x="16" y="91" width="112" height="48" rx="8" className="fill-surface-raised stroke-line-strong" />
      <text x="72" y="112" textAnchor="middle" className="fill-fg">
        Human Pass
      </text>
      <text x="72" y="127" textAnchor="middle" className="fill-fg-subtle">
        passkey · 1 tap
      </text>
      <g data-stagger>
        {SITES.map(({ site, pseudonym }, index) => {
          const top = 22 + index * 70;
          return (
            <g key={site}>
              <path
                d={`M128 115 C 180 115, 190 ${top + 24}, 240 ${top + 24}`}
                fill="none"
                className="stroke-line-strong"
                strokeDasharray="3 3"
              />
              <rect x="240" y={top} width="144" height="48" rx="8" className="fill-surface stroke-line" />
              <text x="254" y={top + 20} className="fill-fg-muted">
                {site}
              </text>
              <text x="254" y={top + 36} className="fill-fg-subtle">
                pseudonym {pseudonym}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
