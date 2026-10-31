import type { HeadDirection } from "../../../src/shared/pose-arc";

/**
 * Head pose from face-mesh landmarks: pure geometry, no model. Landmarks are MediaPipe Face Mesh
 * indices; "right" and "left" are the person's own, so in an unmirrored frame the right eye is on the
 * image's left.
 */
export const LANDMARK = {
  noseTip: 1,
  rightEyeOuter: 33,
  leftEyeOuter: 263,
  mouthRight: 61,
  mouthLeft: 291,
} as const;

export interface HeadPose {
  /** Positive toward the person's left: the nose moves right in the unmirrored frame. */
  readonly yawDeg: number;
  /** Positive when the chin lifts. */
  readonly pitchDeg: number;
  /** Positive when the head tilts clockwise on screen. */
  readonly rollDeg: number;
}

type Vec = readonly [number, number, number];

const at = (points: Float32Array, index: number): Vec => [
  points[index * 3]!,
  points[index * 3 + 1]!,
  points[index * 3 + 2]!,
];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec): Vec => {
  const size = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / size, a[1] / size, a[2] / size];
};
const degrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * Where the head points, from the mesh's 3D landmarks (x right, y down, z away from the camera, all in
 * the same units). The eye corners give the head's sideways axis and the eyes-to-mouth line its
 * downward axis; their cross product is where the face points, which a flat picture of a face never
 * changes however the picture is tilted.
 */
export function headPose(points: Float32Array): HeadPose {
  const rightEye = at(points, LANDMARK.rightEyeOuter);
  const leftEye = at(points, LANDMARK.leftEyeOuter);
  const sideways = unit(sub(leftEye, rightEye));
  const downward = unit(
    sub(mid(at(points, LANDMARK.mouthRight), at(points, LANDMARK.mouthLeft)), mid(rightEye, leftEye)),
  );
  // Down × right points out of the face, toward the camera (−z) when it looks straight at it.
  const facing = unit(cross(downward, sideways));
  return {
    yawDeg: degrees(Math.atan2(facing[0], -facing[2])),
    pitchDeg: degrees(Math.atan2(-facing[1], -facing[2])),
    rollDeg: degrees(Math.atan2(sideways[1], sideways[0])),
  };
}

/** The cloud's points about their centroid, as doubles. */
function centered(points: Float32Array): Float64Array {
  const n = points.length / 3;
  const centroid = [0, 0, 0];
  for (let i = 0; i < points.length; i++) {
    centroid[i % 3]! += points[i]! / n;
  }
  const out = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    out[i] = points[i]! - centroid[i % 3]!;
  }
  return out;
}

/** Steps of the shifted power method; the 4 × 4 form converges long before this. */
const HORN_ITERATIONS = 100;

/**
 * How the head in `to` is turned relative to the head in `from`: the rotation that best aligns the two
 * landmark clouds about their centroids (Horn 1987: the unit quaternion maximizing their correlation
 * is the top eigenvector of a 4 × 4 form, found here by power iteration), read as the turn of a frontal
 * face. Whatever depth bias the mesh has for one face cancels between its own frames, and a flat
 * picture of a face doesn't turn the cloud however the picture is tilted.
 */
export function headTurn(from: Float32Array, to: Float32Array): HeadPose {
  const a = centered(from);
  const b = centered(to);
  const s = new Float64Array(9);
  for (let i = 0; i < a.length; i += 3) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        s[r * 3 + c]! += a[i + r]! * b[i + c]!;
      }
    }
  }
  const S = (r: number, c: number): number => s[r * 3 + c]!;
  const m = [
    [S(0, 0) + S(1, 1) + S(2, 2), S(1, 2) - S(2, 1), S(2, 0) - S(0, 2), S(0, 1) - S(1, 0)],
    [S(1, 2) - S(2, 1), S(0, 0) - S(1, 1) - S(2, 2), S(0, 1) + S(1, 0), S(2, 0) + S(0, 2)],
    [S(2, 0) - S(0, 2), S(0, 1) + S(1, 0), -S(0, 0) + S(1, 1) - S(2, 2), S(1, 2) + S(2, 1)],
    [S(0, 1) - S(1, 0), S(2, 0) + S(0, 2), S(1, 2) + S(2, 1), -S(0, 0) - S(1, 1) + S(2, 2)],
  ] as const;
  // Shifted so every eigenvalue is positive and the largest stays largest.
  const shift = Math.hypot(...m.flat());
  let q = [1, 0.01, 0.01, 0.01];
  for (let step = 0; step < HORN_ITERATIONS; step++) {
    const next = m.map((row, r) => row.reduce((acc, value, c) => acc + value * q[c]!, 0) + shift * q[r]!);
    const size = Math.hypot(...next) || 1;
    q = next.map((value) => value / size);
  }
  const [w, x, y, z] = q as [number, number, number, number];
  // Where a frontal face's forward (0, 0, −1) and sideways (1, 0, 0) end up under the rotation.
  const facing: Vec = [-2 * (x * z + y * w), -2 * (y * z - x * w), -(1 - 2 * (x * x + y * y))];
  const sideways: Vec = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)];
  return {
    yawDeg: degrees(Math.atan2(facing[0], -facing[2])),
    pitchDeg: degrees(Math.atan2(-facing[1], -facing[2])),
    rollDeg: degrees(Math.atan2(sideways[1], sideways[0])),
  };
}

/**
 * The pose on the ring the person sees (degrees counterclockwise from their right on the mirrored
 * preview: right 0, up 90, left 180, down 270), and how far from center, in degrees. A turn toward
 * the person's right is a negative yaw; a lifted chin a positive pitch.
 */
export function headDirection(pose: HeadPose): HeadDirection {
  const angle = (degrees(Math.atan2(pose.pitchDeg, -pose.yawDeg)) + 360) % 360;
  return { angle, magnitude: Math.hypot(pose.yawDeg, pose.pitchDeg) };
}
