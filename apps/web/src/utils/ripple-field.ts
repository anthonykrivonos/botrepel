export interface RipplePoint {
  readonly x: number;
  readonly y: number;
}

/** Brightness has one peak at the pointer and decays smoothly to the same baseline everywhere. */
export const rippleDotOpacity = (distance: number, strength = 1): number =>
  0.09 + 0.43 * Math.max(0, Math.min(1, strength)) * Math.exp(-Math.max(0, distance) / 160);

export interface RippleField {
  readonly columns: number;
  readonly rows: number;
  readonly spacing: number;
  readonly heights: Float32Array;
  readonly velocities: Float32Array;
}

/** A small heightfield, independent of canvas resolution. */
export function createRippleField(width: number, height: number): RippleField {
  const spacing = Math.max(24, Math.sqrt((width * height) / 4000));
  const columns = Math.ceil(width / spacing) + 2;
  const rows = Math.ceil(height / spacing) + 2;
  return {
    columns,
    rows,
    spacing,
    heights: new Float32Array(columns * rows),
    velocities: new Float32Array(columns * rows),
  };
}

/** A moving disturbance leaves a wake; a stationary pointer does not emit repeated rings. */
export function disturbRippleField(field: RippleField, from: RipplePoint, to: RipplePoint): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance < 0.1) {
    return;
  }
  const radius = 72;
  const steps = Math.min(12, Math.max(1, Math.ceil(distance / (radius / 2))));
  for (let step = 0; step < steps; step++) {
    const start = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps };
    const end = {
      x: from.x + ((to.x - from.x) * (step + 1)) / steps,
      y: from.y + ((to.y - from.y) * (step + 1)) / steps,
    };
    const left = Math.max(1, Math.floor((Math.min(start.x, end.x) - radius * 2) / field.spacing));
    const right = Math.min(field.columns - 2, Math.ceil((Math.max(start.x, end.x) + radius * 2) / field.spacing));
    const top = Math.max(1, Math.floor((Math.min(start.y, end.y) - radius * 2) / field.spacing));
    const bottom = Math.min(field.rows - 2, Math.ceil((Math.max(start.y, end.y) + radius * 2) / field.spacing));
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        const x = (column - 0.5) * field.spacing;
        const y = (row - 0.5) * field.spacing;
        const before = Math.exp(-((x - start.x) ** 2 + (y - start.y) ** 2) / radius ** 2);
        const after = Math.exp(-((x - end.x) ** 2 + (y - end.y) ** 2) / radius ** 2);
        const index = row * field.columns + column;
        field.heights[index] = Math.max(-3, Math.min(3, field.heights[index]! + (after - before) * 2.4));
      }
    }
  }
}

/** Fixed 30 Hz step: neighboring heights propagate the wave; drag dissipates its energy. */
export function advanceRippleField({ columns, rows, heights, velocities }: RippleField): void {
  for (let row = 1; row < rows - 1; row++) {
    for (let column = 1; column < columns - 1; column++) {
      const index = row * columns + column;
      const adjacent =
        heights[index - 1]! + heights[index + 1]! + heights[index - columns]! + heights[index + columns]!;
      const diagonal =
        heights[index - columns - 1]! +
        heights[index - columns + 1]! +
        heights[index + columns - 1]! +
        heights[index + columns + 1]!;
      const laplacian = adjacent * 0.2 + diagonal * 0.05 - heights[index]!;
      velocities[index] = (velocities[index]! + laplacian * 0.32) * 0.988;
    }
  }
  for (let index = 0; index < heights.length; index++) {
    heights[index] = (heights[index]! + velocities[index]!) * 0.999;
  }
}
