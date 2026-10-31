/**
 * The hero faces' point clouds: public/faces/<name>.bin, built by `bun run face:points` from
 * MakeHuman's CC0 mesh. Records are Int16 x, y, z (multiples of FACE_SCALE, y up, about ±1.1) and
 * the unit normal times the surface's albedo (multiples of 1 / 32767).
 */
/** The faces the hero shows, in order. */
export const FACES = ["asian-woman", "black-man", "white-woman"] as const;
export const facePath = (name: (typeof FACES)[number]): string => `/faces/${name}.bin`;
export const FACE_SCALE = 1 / 16_384;
/** Grid spacing between points, in the same units as the positions. */
export const FACE_STEP = 0.025;
const STRIDE = 6;

export interface FacePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The unit normal. */
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  /** How much light the surface returns, 0–1: hair and eyes are darker than skin. */
  readonly albedo: number;
}

export function parseFace(buffer: ArrayBuffer): FacePoint[] {
  const values = new Int16Array(buffer);
  const points: FacePoint[] = [];
  for (let index = 0; index + STRIDE <= values.length; index += STRIDE) {
    const [x, y, z, nx, ny, nz] = values.subarray(index, index + STRIDE);
    const albedo = Math.hypot(nx!, ny!, nz!) / 32_767 || 1;
    points.push({
      x: x! * FACE_SCALE,
      y: y! * FACE_SCALE,
      z: z! * FACE_SCALE,
      nx: nx! / 32_767 / albedo,
      ny: ny! / 32_767 / albedo,
      nz: nz! / 32_767 / albedo,
      albedo,
    });
  }
  return points;
}
