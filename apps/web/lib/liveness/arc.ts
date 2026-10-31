import type { Random } from "./random";
import { ARC_DEGREES, DIRECTIONS, type Arc } from "../../src/shared/liveness";

/** How often the arc is a full circle rather than a quarter or half turn. */
export const FULL_TURN_SHARE = 0.25;

/** A random arc: any start, either sense, a quarter or half turn, or a full circle. */
export function pickArc(random: Random): Arc {
  const from = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)]!;
  const clockwise = random() < 0.5;
  const roll = random();
  if (roll < FULL_TURN_SHARE) {
    return { from, to: from, clockwise };
  }
  const span = roll < FULL_TURN_SHARE + (1 - FULL_TURN_SHARE) / 2 ? 90 : 180;
  const degrees = (ARC_DEGREES[from] + (clockwise ? -span : span) + 360) % 360;
  const to = DIRECTIONS.find((direction) => ARC_DEGREES[direction] === degrees)!;
  return { from, to, clockwise };
}
