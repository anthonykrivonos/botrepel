/**
 * Synthetic heads for liveness fixtures: per-pixel geometry (depth, normal, albedo, material) at a
 * pose, size and framing, from the CC0 MakeHuman point clouds the site's hero uses
 * (public/faces/<name>.bin) or a parametric ellipsoid. Never photos of people.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FACE_STEP, type FACES, parseFace, type FacePoint } from "../../src/shared/face";

export type HeadName = (typeof FACES)[number] | "ellipsoid";

export interface Pose {
  /** Positive turns the head to the person's left: in the unmirrored image the nose moves right (+x). */
  readonly yawDeg: number;
  /** Positive tilts the chin up. */
  readonly pitchDeg: number;
  readonly rollDeg?: number;
}

export interface Framing {
  /** The head's height as a share of the frame's height (1 fills it). */
  readonly scale: number;
  /** Pixels the head's center moves right and down. */
  readonly dx: number;
  readonly dy: number;
}

export const MATERIAL = { background: 0, skin: 1, dark: 2 } as const;

/** Per-pixel geometry, row-major, `width * height` entries each. */
export interface GBuffer {
  readonly width: number;
  readonly height: number;
  /** Toward the camera; NaN where there is no surface. */
  readonly depth: Float32Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  /** 0–1 (hair and eyes are darker than skin). */
  readonly albedo: Float32Array;
  readonly material: Uint8Array;
  /** How many pixels hold surface. */
  readonly coverage: number;
}

export const FRONTAL: Pose = { yawDeg: 0, pitchDeg: 0 };
export const FILLING: Framing = { scale: 1, dx: 0, dy: 0 };

/** Below this albedo the .bin points are hair or eyes, which reflect the screen less like skin. */
const DARK_ALBEDO = 0.6;
/** The heads span about this many units top to bottom. */
const HEAD_HEIGHT = 2.2;

const points = new Map<HeadName, FacePoint[]>();

function ellipsoidPoints(): FacePoint[] {
  const out: FacePoint[] = [];
  const rx = 0.8;
  const ry = 1.05;
  const rz = 0.75;
  for (let y = -ry; y <= ry; y += FACE_STEP) {
    for (let x = -rx; x <= rx; x += FACE_STEP) {
      const inside = (x / rx) ** 2 + (y / ry) ** 2;
      if (inside >= 1) {
        continue;
      }
      const nose = 0.22 * Math.exp(-((x / 0.11) ** 2) - ((y + 0.05) / 0.22) ** 2);
      const z = rz * Math.sqrt(1 - inside) + nose;
      // The gradient of the ellipsoid plus the nose bump, as the normal.
      const gx = (x / rx ** 2) * (rz / Math.sqrt(1 - inside)) + (nose * (2 * x)) / 0.11 ** 2;
      const gy = (y / ry ** 2) * (rz / Math.sqrt(1 - inside)) + (nose * (2 * (y + 0.05))) / 0.22 ** 2;
      const size = Math.hypot(gx, gy, 1);
      const eye = Math.hypot(Math.abs(x) - 0.32, y - 0.25) < 0.09;
      const mouth = Math.abs(y + 0.5) < 0.05 && Math.abs(x) < 0.25;
      out.push({ x, y, z, nx: gx / size, ny: gy / size, nz: 1 / size, albedo: eye ? 0.25 : mouth ? 0.55 : 1 });
    }
  }
  return out;
}

function headPoints(name: HeadName): FacePoint[] {
  let cached = points.get(name);
  if (!cached) {
    cached =
      name === "ellipsoid"
        ? ellipsoidPoints()
        : parseFace(readFileSync(resolve(import.meta.dir, "../../public/faces", `${name}.bin`)).buffer as ArrayBuffer);
    points.set(name, cached);
  }
  return cached;
}

interface Rotation {
  readonly m: readonly [number, number, number, number, number, number, number, number, number];
}

function rotation(pose: Pose): Rotation {
  const yaw = (pose.yawDeg * Math.PI) / 180;
  // Negated: the rotation about x below is right-handed, which would drop the chin for a positive angle.
  const pitch = (-pose.pitchDeg * Math.PI) / 180;
  const roll = ((pose.rollDeg ?? 0) * Math.PI) / 180;
  const [cy, sy, cp, sp, cr, sr] = [
    Math.cos(yaw),
    Math.sin(yaw),
    Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(roll),
    Math.sin(roll),
  ];
  // Roll (about z), then pitch (about x), then yaw (about y): R = Ry · Rx · Rz.
  const rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
  const rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
  const ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const mul = (a: number[], b: number[]): number[] =>
    Array.from({ length: 9 }, (_, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      return a[row * 3]! * b[col]! + a[row * 3 + 1]! * b[3 + col]! + a[row * 3 + 2]! * b[6 + col]!;
    });
  return { m: mul(ry, mul(rx, rz)) as unknown as Rotation["m"] };
}

const apply = (r: Rotation, x: number, y: number, z: number): [number, number, number] => [
  r.m[0] * x + r.m[1] * y + r.m[2] * z,
  r.m[3] * x + r.m[4] * y + r.m[5] * z,
  r.m[6] * x + r.m[7] * y + r.m[8] * z,
];

const cache = new Map<string, GBuffer>();

/**
 * Rasterizes a head: rotates the points, projects them orthographically, splats each into the
 * nearest pixels with a depth test, then fills single-pixel holes from their neighbors. Memoized.
 */
export function gBuffer(
  head: HeadName,
  pose: Pose = FRONTAL,
  width = 96,
  height = width,
  framing: Framing = FILLING,
  flat = false,
): GBuffer {
  const key = JSON.stringify([head, pose, width, height, framing, flat]);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const n = width * height;
  const depth = new Float32Array(n).fill(Number.NaN);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  const nz = new Float32Array(n);
  const albedo = new Float32Array(n);
  const material = new Uint8Array(n);
  const r = rotation(pose);
  const scale = (height * framing.scale) / HEAD_HEIGHT;
  const splat = Math.max(1, Math.round(scale * FACE_STEP * 1.3));
  const cx = width / 2 + framing.dx;
  const cy = height / 2 + framing.dy;
  // The plane's normal, when the head is a printed card being rotated.
  const [fnx, fny, fnz] = apply(r, 0, 0, 1);
  for (const p of headPoints(head)) {
    const [x, y, z] = apply(r, p.x, p.y, flat ? 0 : p.z);
    const [pnx, pny, pnz] = flat ? [fnx, fny, fnz] : apply(r, p.nx, p.ny, p.nz);
    const px = Math.round(cx + x * scale - splat / 2);
    const py = Math.round(cy - y * scale - splat / 2);
    for (let row = py; row < py + splat; row++) {
      for (let col = px; col < px + splat; col++) {
        if (row < 0 || row >= height || col < 0 || col >= width) {
          continue;
        }
        const i = row * width + col;
        if (!(z > depth[i]!) && !Number.isNaN(depth[i])) {
          continue;
        }
        depth[i] = z;
        nx[i] = pnx;
        ny[i] = pny;
        nz[i] = pnz;
        albedo[i] = p.albedo;
        material[i] = p.albedo < DARK_ALBEDO ? MATERIAL.dark : MATERIAL.skin;
      }
    }
  }
  // Holes: a missing pixel with most neighbors present takes their average.
  const filled = depth.slice();
  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      const i = row * width + col;
      if (!Number.isNaN(depth[i])) {
        continue;
      }
      let count = 0;
      let sd = 0;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let sa = 0;
      let dark = 0;
      for (const j of [
        i - width - 1,
        i - width,
        i - width + 1,
        i - 1,
        i + 1,
        i + width - 1,
        i + width,
        i + width + 1,
      ]) {
        if (Number.isNaN(depth[j])) {
          continue;
        }
        count++;
        sd += depth[j]!;
        sx += nx[j]!;
        sy += ny[j]!;
        sz += nz[j]!;
        sa += albedo[j]!;
        dark += material[j] === MATERIAL.dark ? 1 : 0;
      }
      if (count >= 5) {
        filled[i] = sd / count;
        const size = Math.hypot(sx, sy, sz) || 1;
        nx[i] = sx / size;
        ny[i] = sy / size;
        nz[i] = sz / size;
        albedo[i] = sa / count;
        material[i] = dark * 2 > count ? MATERIAL.dark : MATERIAL.skin;
      }
    }
  }
  let coverage = 0;
  for (const value of filled) {
    coverage += Number.isNaN(value) ? 0 : 1;
  }
  const buffer: GBuffer = { width, height, depth: filled, nx, ny, nz, albedo, material, coverage };
  cache.set(key, buffer);
  return buffer;
}

/** The same head as a flat print: its albedo image on a plane (rotations foreshorten it as a card). */
export const flatBuffer = (head: HeadName, pose: Pose, width: number, height: number, framing: Framing): GBuffer =>
  gBuffer(head, pose, width, height, framing, true);
