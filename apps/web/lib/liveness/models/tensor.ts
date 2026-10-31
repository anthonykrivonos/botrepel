/**
 * Model inputs from a pose frame (side × side RGB bytes, row-major): a square region resampled
 * bilinearly into a float buffer in the layout and range a model expects. Callers own the buffers and
 * zero them when done, since they hold face pixels.
 */

/** A square of the frame, in source pixels. */
export interface Region {
  readonly x: number;
  readonly y: number;
  readonly span: number;
}

export const wholeFrame = (side: number): Region => ({ x: 0, y: 0, span: side });

/** Channel `c` of the frame at a fractional position, bilinearly interpolated. */
function bilinear(frame: Uint8Array, side: number, x: number, y: number, c: number): number {
  const sx = Math.min(side - 1, Math.max(0, x));
  const sy = Math.min(side - 1, Math.max(0, y));
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.min(side - 1, x0 + 1);
  const y1 = Math.min(side - 1, y0 + 1);
  const fx = sx - x0;
  const fy = sy - y0;
  const at = (col: number, row: number): number => frame[(row * side + col) * 3 + c]!;
  return (
    at(x0, y0) * (1 - fx) * (1 - fy) + at(x1, y0) * fx * (1 - fy) + at(x0, y1) * (1 - fx) * fy + at(x1, y1) * fx * fy
  );
}

type Write = (index: number, channel: number, value: number) => void;

function resample(frame: Uint8Array, side: number, region: Region, size: number, write: Write): void {
  const step = (region.span - 1) / (size - 1);
  for (let y = 0; y < size; y++) {
    const sy = region.y + y * step;
    for (let x = 0; x < size; x++) {
      const sx = region.x + x * step;
      const index = y * size + x;
      for (let c = 0; c < 3; c++) {
        write(index, c, bilinear(frame, side, sx, sy, c));
      }
    }
  }
}

/** `region` as size × size RGB floats in [0, 1], NHWC: the face mesh's input. */
export function rgbUnit(frame: Uint8Array, side: number, region: Region, size: number, out: Float32Array): void {
  resample(frame, side, region, size, (index, c, value) => {
    out[index * 3 + c] = value / 255;
  });
}

/** `region` as size × size BGR floats in [0, 255], NCHW: MiniFASNet's input. */
export function bgrByte(frame: Uint8Array, side: number, region: Region, size: number, out: Float32Array): void {
  const plane = size * size;
  resample(frame, side, region, size, (index, c, value) => {
    out[(2 - c) * plane + index] = value;
  });
}
