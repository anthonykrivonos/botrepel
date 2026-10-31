import { useId } from "react";
import { POW_BASE_BITS, POW_MAX_BITS, powBitsFor } from "../shared/pow";
import { LIVENESS_RISK, PRESENCE_RISK } from "../shared/risk";

const [LEFT, RIGHT, TOP, BOTTOM] = [44, 384, 24, 196];
const x = (risk: number): number => LEFT + risk * (RIGHT - LEFT);
const y = (bits: number): number =>
  BOTTOM - ((bits - (POW_BASE_BITS - 1)) / (POW_MAX_BITS - POW_BASE_BITS + 2)) * (BOTTOM - TOP);

/** Proof-of-work difficulty against risk, from the same function the server uses, with the step-up zones. */
export function FigPow(): React.JSX.Element {
  const id = useId();
  const steps = Array.from({ length: 101 }, (_, index) => index / 100);
  const line = steps.map((risk) => `${x(risk).toFixed(1)},${y(powBitsFor(risk)).toFixed(1)}`).join(" ");
  const bits = Array.from({ length: POW_MAX_BITS - POW_BASE_BITS + 1 }, (_, index) => POW_BASE_BITS + index);
  return (
    <svg viewBox="0 0 400 230" role="img" aria-labelledby={`${id}-title`} className="w-full font-mono text-[9px]">
      <title
        id={`${id}-title`}
      >{`Proof-of-work difficulty rises from ${POW_BASE_BITS} to ${POW_MAX_BITS} bits with risk; above ${PRESENCE_RISK} a Human Pass is required, above ${LIVENESS_RISK} flash liveness.`}</title>
      <defs>
        <linearGradient id={`${id}-risk`} gradientUnits="userSpaceOnUse" x1={LEFT} x2={RIGHT} y1="0" y2="0">
          <stop offset="0" stopColor="var(--color-ok)" />
          <stop offset={PRESENCE_RISK} stopColor="var(--color-warn)" />
          <stop offset={LIVENESS_RISK} stopColor="var(--color-danger)" />
          <stop offset="1" stopColor="var(--color-danger)" />
        </linearGradient>
      </defs>
      <rect x={LEFT} y={TOP} width={x(PRESENCE_RISK) - LEFT} height={BOTTOM - TOP} className="fill-ok/[0.06]" />
      <rect
        x={x(PRESENCE_RISK)}
        y={TOP}
        width={x(LIVENESS_RISK) - x(PRESENCE_RISK)}
        height={BOTTOM - TOP}
        className="fill-warn/[0.08]"
      />
      <rect
        x={x(LIVENESS_RISK)}
        y={TOP}
        width={x(1) - x(LIVENESS_RISK)}
        height={BOTTOM - TOP}
        className="fill-danger/[0.1]"
      />
      <text x={LEFT + 6} y={TOP + 14} className="fill-ok">
        Invisible
      </text>
      <text x={x(PRESENCE_RISK) + 6} y={TOP + 14} className="fill-warn">
        Human Pass
      </text>
      <text x={x(LIVENESS_RISK) + 6} y={TOP + 14} className="fill-danger">
        Flash
      </text>
      {[PRESENCE_RISK, LIVENESS_RISK].map((risk) => (
        <line
          key={risk}
          x1={x(risk)}
          x2={x(risk)}
          y1={TOP}
          y2={BOTTOM}
          strokeDasharray="3 4"
          className={risk === PRESENCE_RISK ? "stroke-warn/30" : "stroke-danger/30"}
        />
      ))}
      {bits.map((value) => (
        <g key={value}>
          <line x1={LEFT} x2={RIGHT} y1={y(value)} y2={y(value)} className="stroke-white/[0.06]" />
          <text x={LEFT - 8} y={y(value) + 3} textAnchor="end" className="fill-fg-subtle">
            {value}
          </text>
        </g>
      ))}
      <polyline
        data-draw
        pathLength={1}
        points={line}
        fill="none"
        stroke={`url(#${id}-risk)`}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} className="stroke-line-strong" />
      {[0, 0.5, 0.8, 1].map((risk) => (
        <text key={risk} x={x(risk)} y={BOTTOM + 14} textAnchor="middle" className="fill-fg-subtle">
          {risk}
        </text>
      ))}
      <text x={RIGHT} y={BOTTOM + 28} textAnchor="end" className="fill-fg-subtle">
        risk score →
      </text>
      <text x={LEFT} y={BOTTOM + 28} className="fill-fg-subtle">
        bits of work (each doubles it)
      </text>
    </svg>
  );
}
