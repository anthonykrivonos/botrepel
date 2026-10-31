import { useId } from "react";
import type { Rgb } from "../shared/liveness";
import { sentColor } from "../utils/light";

const SECONDS = 2;
const STOPS = 48;
/** Drawn a little exaggerated (real lag is under one frame) so the eye can see it. */
const LAG_S = 0.12;

const rgb = ([r, g, b]: Rgb): string => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;

/** Two seconds of light sent by the screen, and the reflection that follows it. */
export function FigSchedule(): React.JSX.Element {
  const id = useId();
  const stops = Array.from({ length: STOPS + 1 }, (_, index) => (index / STOPS) * SECONDS);
  const gradient = (name: string, lag: number): React.JSX.Element => (
    <linearGradient id={`${id}-${name}`}>
      {stops.map((t) => (
        <stop key={t} offset={t / SECONDS} stopColor={rgb(sentColor(1.2 + t - lag))} />
      ))}
    </linearGradient>
  );
  return (
    <svg viewBox="0 0 400 230" role="img" aria-labelledby={`${id}-title`} className="w-full font-mono text-[9px]">
      <title id={`${id}-title`}>
        A two-second color sequence on the screen, and its reflection off a face arriving a moment later.
      </title>
      <defs>
        {gradient("sent", 0)}
        {gradient("reflected", LAG_S)}
      </defs>
      <text x="16" y="36" className="fill-fg-subtle">
        SENT · one-time sequence, under 3 Hz
      </text>
      <rect x="16" y="44" width="368" height="40" rx="6" fill={`url(#${id}-sent)`} />
      <text x="16" y="126" className="fill-fg-subtle">
        REFLECTED · per face region, lagging
      </text>
      <rect x="16" y="134" width="368" height="40" rx="6" fill={`url(#${id}-reflected)`} opacity="0.6" />
      <line x1="16" x2="384" y1="196" y2="196" className="stroke-line-strong" />
      {[0, 0.5, 1, 1.5, 2].map((t) => (
        <text key={t} x={16 + (t / SECONDS) * 368} y="210" textAnchor="middle" className="fill-fg-subtle">
          {t}s
        </text>
      ))}
    </svg>
  );
}
