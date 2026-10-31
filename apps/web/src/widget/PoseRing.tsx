import { arcOffset, barAngles, barCovered, inArc, type PoseArc } from "../shared/pose-arc";
import { cn } from "../utils/cn";

/** The ring sits just outside the 224 px oval; the SVG is 280 px with its origin at the center. */
const INNER = 120;
const LENGTH = 14;
const ANGLES = barAngles();
/** Once the roll is captured, the bars still white turn green in one sweep around the ring. */
const SWEEP_MS = 400;
/** One revolution of the dance's crest: the period of the `--animate-ring-dance` token in styles.css. */
const DANCE_MS = 1000;
/** The sweep and one revolution: how long a completed ring stays on screen at least. */
export const RING_CLOSE_MS = SWEEP_MS + DANCE_MS;

interface PoseRingProps {
  readonly arc: PoseArc;
  readonly progress: number;
  /** The roll is captured: every bar turns green, then a crest circles the ring until it leaves the screen. */
  readonly complete: boolean;
}

/**
 * Bars around the camera oval for the head roll: long and white until the head has covered their
 * angle, then short and green. The bar where the roll starts is brightest, and bars outside a
 * partial arc stay faint. Once the roll is captured, the whole ring closes green from the start bar
 * in the roll's direction, then the bars dance while the server judges. Decorative: the prompt line
 * says what to do.
 */
export function PoseRing({ arc, progress, complete }: PoseRingProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="-140 -140 280 280"
      className="pointer-events-none absolute -top-7 -left-7 size-70 max-w-none"
    >
      {ANGLES.map((angle) => {
        const covered = complete || barCovered(arc, angle, progress);
        const offset = arcOffset(arc, angle);
        // The bar's share of a revolution from the start bar in the roll's direction: its turn in the sweep and the dance.
        const turn = offset / 360;
        return (
          // Drawn pointing up (90°), then turned clockwise to its angle.
          <g key={angle} transform={`rotate(${90 - angle})`}>
            <rect
              x={-1.5}
              y={-(INNER + LENGTH)}
              width={3}
              height={LENGTH}
              rx={1.5}
              className={cn(
                "origin-bottom transition-[scale,fill] duration-300 ease-out [transform-box:fill-box] motion-reduce:transition-none",
                covered
                  ? "scale-y-50 fill-ok"
                  : !inArc(arc, angle)
                    ? "fill-white/15"
                    : offset === 0
                      ? "fill-white"
                      : "fill-white/55",
                complete && "animate-ring-dance motion-reduce:animate-none",
              )}
              style={
                complete
                  ? { transitionDelay: `${turn * SWEEP_MS}ms`, animationDelay: `${SWEEP_MS + turn * DANCE_MS}ms` }
                  : undefined
              }
            />
          </g>
        );
      })}
    </svg>
  );
}
