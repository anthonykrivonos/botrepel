/**
 * The hero figure's subject: a young woman with an oval face, a soft V-line jaw, almond eyes with
 * a double-lid crease, a low nose bridge, full lips, and long hair with bangs. Geometry is a depth
 * field (y up, about -1.15 to 1.12) sampled on a grid; albedo darkens hair, brows, lashes, and irises
 * so the face reads under flat screen light. The eyes are shaded per frame so the face can blink.
 */

export interface FacePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  /** Surface brightness, 0–1 (catchlights go above 1). */
  readonly albedo: number;
  /** Position relative to the nearer eye's center (x outward), for points the blink re-shades. */
  readonly eye?: { readonly x: number; readonly y: number };
}

export const FACE_STEP = 0.014;

const EYE_X = 0.215;
const EYE_Y = 0.115;
const BOTTOM = -1.15;

type Part = "skin" | "hair" | "neck";

interface Sample {
  readonly z: number;
  readonly albedo: number;
  readonly part: Part;
}

const gauss = (dx: number, dy: number, rx: number, ry: number): number => Math.exp(-((dx / rx) ** 2) - (dy / ry) ** 2);
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
/** A max without a crease where the two surfaces cross. */
const smoothMax = (a: number, b: number, k: number): number => (a + b + Math.sqrt((a - b) ** 2 + k * k)) / 2;

/** Half the face's width at height y: a rounded forehead over a jaw that narrows to a soft point. */
function faceHalfWidth(y: number): number {
  if (y >= 0) {
    return y >= 1 ? 0 : 0.62 * Math.sqrt(1 - y * y);
  }
  const t = Math.min(1, -y / 0.92);
  return 0.62 * Math.max(0, 1 - t ** 1.8) ** 0.6;
}

function skinDepth(x: number, y: number): number {
  const halfWidth = faceHalfWidth(y);
  const inside = halfWidth > 0 ? 1 - (x / halfWidth) ** 2 : 0;
  if (inside <= 0) {
    return Number.NaN;
  }
  const ax = Math.abs(x);
  return (
    0.62 * Math.sqrt(inside) * (1 - 0.18 * y * y) +
    0.08 * gauss(ax - 0.27, y + 0.06, 0.16, 0.12) - // cheeks, lifted by the smile
    0.025 * gauss(ax - EYE_X, y - EYE_Y, 0.13, 0.075) + // shallow eye sockets
    0.02 * gauss(ax - EYE_X, y - EYE_Y, 0.09, 0.04) + // eyeballs
    0.02 * gauss(ax - 0.2, y - 0.25, 0.2, 0.05) + // brow ridge
    0.05 * gauss(x, y + 0.05, 0.045, 0.17) + // nose bridge
    0.085 * gauss(x, y + 0.22, 0.062, 0.055) + // nose tip
    0.03 * gauss(ax - 0.065, y + 0.255, 0.04, 0.035) - // nostril wings
    0.012 * gauss(x, y + 0.33, 0.08, 0.03) -
    0.008 * gauss(x, y + 0.38, 0.018, 0.04) + // philtrum
    0.045 * gauss(x, y + 0.445, 0.14, 0.024) + // upper lip
    0.05 * gauss(x, y + 0.525, 0.125, 0.034) + // lower lip
    0.015 * gauss(ax - 0.17, y + 0.44, 0.04, 0.04) - // smile corners
    0.012 * gauss(x, y + 0.6, 0.1, 0.025) +
    0.035 * gauss(x, y + 0.78, 0.11, 0.08) - // chin
    0.015 * gauss(ax - 0.5, y - 0.2, 0.08, 0.2) // temples
  );
}

function skinAlbedo(x: number, y: number): number {
  const ax = Math.abs(x);
  // Soft, slightly arched brows that taper outward.
  if (ax > 0.07 && ax < 0.37) {
    const center = 0.265 + 0.04 * (1 - ((ax - 0.21) / 0.15) ** 2);
    const thickness = 0.016 * (1 - 0.55 * Math.max(0, (ax - 0.21) / 0.16));
    if (Math.abs(y - center) < thickness) {
      return 0.45;
    }
  }
  if (ax < 0.14 && Math.abs(y - (-0.49 + 0.03 * (x / 0.14) ** 2)) < 0.005) {
    return 0.35; // where the lips meet, curving up into a smile
  }
  if (gauss(ax - 0.04, y + 0.29, 0.022, 0.012) > 0.5) {
    return 0.55; // nostrils
  }
  const lips = Math.max(gauss(x, y + 0.445, 0.14, 0.022), gauss(x, y + 0.525, 0.12, 0.03));
  return 1 - 0.4 * lips;
}

/** The bangs' wispy lower edge. */
const bangsEdge = (x: number): number => 0.4 + 0.06 * (x / 0.5) ** 2 - 0.025 * Math.abs(Math.sin(x * 22));

function hairAlbedo(x: number, y: number): number {
  const ring = Math.sqrt((x / 0.74) ** 2 + ((y - 0.1) / 1.02) ** 2);
  // Strands run down the sides and radiate from the crown; light catches a band across the top.
  const strands = y > 0.1 ? Math.atan2(x, y - 0.1) * 60 : x * 95 + 2 * Math.sin(y * 7);
  const sheen = y > 0.3 ? 0.28 * Math.exp(-(((ring - 0.8) / 0.07) ** 2)) : 0;
  const fade = clamp01((y - BOTTOM) / 0.3);
  return (0.27 + 0.07 * Math.sin(strands) + sheen) * fade;
}

/** The hair's outline: a dome over the crown, then long hair that flares a little and thins at the ends. */
function inHair(x: number, y: number): boolean {
  if (y > 0.1) {
    return (x / 0.76) ** 2 + ((y - 0.1) / 1.02) ** 2 < 1;
  }
  const flare = 0.76 + 0.07 * (0.1 - y);
  const ends = y < -0.8 ? 1 - 0.25 * ((-0.8 - y) / 0.35) ** 2 : 1;
  return y > BOTTOM && Math.abs(x) < flare * ends;
}

/** The hair's surface: a smooth curtain around the head, so it falls in front of the face's edges. */
function hairDepth(x: number, y: number): number {
  const curtain = 0.62 * Math.sqrt(Math.max(0, 1 - (x / 0.84) ** 2));
  const dome = 0.62 * Math.sqrt(Math.max(0, 1 - (x / 0.76) ** 2 - ((y - 0.1) / 1.02) ** 2));
  return y > 0.1 ? Math.max(dome, curtain * Math.sqrt(Math.max(0, 1 - ((y - 0.1) / 1.02) ** 2))) : curtain;
}

function sample(x: number, y: number): Sample | undefined {
  const skin = skinDepth(x, y);
  const ax = Math.abs(x);
  // The face shows through an opening in the hair, a little narrower than the face itself.
  const opening = faceHalfWidth(y) * (0.84 + 0.17 * clamp01((-0.25 - y) / 0.3));
  if (!Number.isNaN(skin) && ax < opening && !(ax < 0.5 && y > bangsEdge(x))) {
    return { z: skin, albedo: skinAlbedo(x, y), part: "skin" };
  }
  if (inHair(x, y)) {
    // One continuous surface for bangs, crown, and lengths, always just in front of the skin.
    const z = Number.isNaN(skin) ? hairDepth(x, y) : smoothMax(hairDepth(x, y), skin + 0.03, 0.08);
    return { z, albedo: hairAlbedo(x, y), part: "hair" };
  }
  if (ax < 0.19 && y > BOTTOM) {
    const shadow = clamp01((-0.82 - y) / 0.2);
    return {
      z: 0.25 * Math.sqrt(1 - (x / 0.19) ** 2),
      albedo: 0.55 * (0.4 + 0.6 * shadow) * clamp01((y - BOTTOM) / 0.3),
      part: "neck",
    };
  }
  return undefined;
}

/** A grid over the head with surface normals from finite differences; build once. */
export function facePoints(): FacePoint[] {
  const points: FacePoint[] = [];
  const h = 0.004;
  for (let y = BOTTOM; y <= 1.13; y += FACE_STEP) {
    for (let x = -0.86; x <= 0.86; x += FACE_STEP * 0.866) {
      const here = sample(x, y);
      if (!here) {
        continue;
      }
      const right = sample(x + h, y);
      const up = sample(x, y + h);
      // Across an edge between parts (hair over skin), treat the surface as flat.
      const nx = right?.part === here.part ? -(right.z - here.z) / h : 0;
      const ny = up?.part === here.part ? -(up.z - here.z) / h : 0;
      const length = Math.hypot(nx, ny, 1);
      const ex = Math.abs(x) - EYE_X;
      const ey = y - EYE_Y;
      const nearEye = here.part === "skin" && Math.abs(ex) < 0.15 && Math.abs(ey) < 0.1;
      points.push({
        x,
        y,
        z: here.z,
        nx: nx / length,
        ny: ny / length,
        nz: 1 / length,
        albedo: here.albedo,
        ...(nearEye ? { eye: { x: ex, y: ey } } : {}),
      });
    }
  }
  return points;
}

/** How open the eyes are at time t (seconds): a quick blink every few seconds. */
export function eyeOpenness(t: number): number {
  const phase = (t % 4.6) / 0.2;
  return phase < 1 ? Math.abs(1 - 2 * phase) ** 0.6 : 1;
}

/** Albedo around an eye: sclera, iris with a catchlight, lash lines, and the lid crease. */
export function eyeAlbedo(ex: number, ey: number, open: number): number {
  const tilted = ey - 0.1 * ex; // outer corners lift slightly
  const height = 0.06 * open * Math.max(0, 1 - (ex / 0.135) ** 2) ** 0.65;
  // Smiling eyes: the lower lid sits higher and flatter than the upper one.
  if (height > 0.002 && tilted < height && tilted > -0.6 * height) {
    if (Math.hypot(ex - 0.015, tilted - 0.017) < 0.011) {
      return 1.6;
    }
    const iris = Math.hypot(ex + 0.005, tilted + 0.003);
    return iris < 0.046 ? 0.12 + 0.18 * (iris / 0.046) : 0.9;
  }
  const aboveLid = tilted - height;
  if (Math.abs(ex) < 0.145 && aboveLid >= 0 && aboveLid < 0.009 + 0.007 * Math.max(0, ex / 0.12)) {
    return 0.15; // upper lashes, winged slightly at the outer corner
  }
  const belowLid = -0.6 * height - tilted;
  if (Math.abs(ex) < 0.13 && belowLid >= 0 && belowLid < 0.005) {
    return 0.8;
  }
  if (Math.abs(ex) < 0.1 && Math.abs(tilted - (0.083 - 0.02 * (ex / 0.1) ** 2)) < 0.004) {
    return 0.85; // double-lid crease
  }
  return 1;
}
