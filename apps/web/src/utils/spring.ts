export interface Spring {
  readonly value: number;
  readonly velocity: number;
}

/** Natural frequency (rad/s) and damping ratio: a quick, soft settle with a hint of overshoot. */
const STIFFNESS = 38;
const DAMPING = 2 * 0.72 * Math.sqrt(STIFFNESS);

/**
 * Advances a damped spring toward `target` by `dt` seconds (semi-implicit Euler, stable at frame
 * rates). The value is held within ±`limit`; at the limit, velocity pushing outward is dropped.
 */
export function stepSpring({ value, velocity }: Spring, target: number, dt: number, limit: number): Spring {
  const nextVelocity = velocity + (STIFFNESS * (target - value) - DAMPING * velocity) * dt;
  const nextValue = value + nextVelocity * dt;
  if (Math.abs(nextValue) <= limit) {
    return { value: nextValue, velocity: nextVelocity };
  }
  const bound = Math.sign(nextValue) * limit;
  return { value: bound, velocity: Math.sign(nextVelocity) === Math.sign(bound) ? 0 : nextVelocity };
}
