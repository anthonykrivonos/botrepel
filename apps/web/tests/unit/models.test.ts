import { describe, expect, test } from "bun:test";
import { GEOMETRY, meshGeometry, verifyArc, type PoseFrame } from "../../lib/liveness/models/geometry";
import { detectMesh, MESH, meshScratch } from "../../lib/liveness/models/mesh";
import { miniFasPad, padRegion } from "../../lib/liveness/models/pad";
import { headDirection, headPose, headTurn, LANDMARK } from "../../lib/liveness/models/pose";
import { checkedModel } from "../../lib/liveness/models/runtime";
import manifest from "../../models/manifest.json";
import { KEY_CROP, type Arc } from "../../src/shared/liveness";
import { scheduleFor } from "../fixtures/metrics";
import { renderCapture, scenario, type AttackLabel } from "../fixtures/synth-scene";

const rad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * A head point (x right, y down, z away from the camera) about the head's center at (100, 100, 0),
 * turned by `yaw` about the vertical axis (positive toward the person's left) and then `pitch` about
 * the sideways axis (positive lifts the chin).
 */
function turned(x: number, y: number, z: number, yawDeg: number, pitchDeg: number): [number, number, number] {
  const [cy, sy, cp, sp] = [
    Math.cos(rad(yawDeg)),
    Math.sin(rad(yawDeg)),
    Math.cos(rad(pitchDeg)),
    Math.sin(rad(pitchDeg)),
  ];
  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  return [100 + x1, 100 + y * cp + z1 * sp, -y * sp + z1 * cp];
}

/** A face's key points as mesh landmarks, turned. */
function face(yawDeg: number, pitchDeg: number): Float32Array {
  const points = new Float32Array(MESH.points * 3);
  const place = (index: number, x: number, y: number, z: number): void => {
    points.set(turned(x, y, z, yawDeg, pitchDeg), index * 3);
  };
  place(LANDMARK.rightEyeOuter, -30, -20, 0);
  place(LANDMARK.leftEyeOuter, 30, -20, 0);
  place(LANDMARK.mouthRight, -20, 25, 0);
  place(LANDMARK.mouthLeft, 20, 25, 0);
  place(LANDMARK.noseTip, 0, 5, -15);
  return points;
}

/** A fixed scatter of mesh points through a head's volume, turned rigidly. */
function cloud(yawDeg: number, pitchDeg: number): Float32Array {
  const points = new Float32Array(MESH.points * 3);
  let seed = 7;
  const next = (): number => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  for (let i = 0; i < MESH.points; i++) {
    points.set(turned(80 * next(), 100 * next(), 40 * next(), yawDeg, pitchDeg), i * 3);
  }
  return points;
}

describe("head pose from landmarks", () => {
  test("recovers yaw and pitch, positive toward the person's left and with the chin up", () => {
    const frontal = headPose(face(0, 0));
    expect(Math.abs(frontal.yawDeg) + Math.abs(frontal.pitchDeg) + Math.abs(frontal.rollDeg)).toBe(0);
    expect(headPose(face(20, 0)).yawDeg).toBeCloseTo(20, 3);
    expect(headPose(face(-20, 0)).yawDeg).toBeCloseTo(-20, 3);
    expect(headPose(face(0, 15)).pitchDeg).toBeCloseTo(15, 3);
    expect(headPose(face(0, -15)).pitchDeg).toBeCloseTo(-15, 3);
    const both = headPose(face(15, 10));
    expect(Math.abs(both.yawDeg - 15)).toBeLessThan(2);
    expect(Math.abs(both.pitchDeg - 10)).toBeLessThan(2);
  });

  test("reads the turn between two frames of the same head, from any starting pose", () => {
    const rest = cloud(0, 0);
    const still = headTurn(rest, rest);
    expect(Math.abs(still.yawDeg) + Math.abs(still.pitchDeg) + Math.abs(still.rollDeg)).toBeLessThan(0.01);
    expect(headTurn(rest, cloud(20, 0)).yawDeg).toBeCloseTo(20, 1);
    expect(headTurn(rest, cloud(-20, 0)).yawDeg).toBeCloseTo(-20, 1);
    expect(headTurn(rest, cloud(0, 15)).pitchDeg).toBeCloseTo(15, 1);
    expect(headTurn(rest, cloud(0, -15)).pitchDeg).toBeCloseTo(-15, 1);
    const both = headTurn(rest, cloud(15, 10));
    expect(Math.abs(both.yawDeg - 15)).toBeLessThan(1);
    expect(Math.abs(both.pitchDeg - 10)).toBeLessThan(1);
    // The same turn from a head that already looked a little down.
    expect(Math.abs(headTurn(cloud(0, -8), cloud(20, -8)).yawDeg - 20)).toBeLessThan(1);
  });

  test("maps a turn to the ring as the person sees it: right 0, up 90, left 180, down 270", () => {
    expect(headDirection({ yawDeg: -10, pitchDeg: 0, rollDeg: 0 })).toEqual({ angle: 0, magnitude: 10 });
    expect(headDirection({ yawDeg: 0, pitchDeg: 10, rollDeg: 0 })).toEqual({ angle: 90, magnitude: 10 });
    expect(headDirection({ yawDeg: 10, pitchDeg: 0, rollDeg: 0 })).toEqual({ angle: 180, magnitude: 10 });
    expect(headDirection({ yawDeg: 0, pitchDeg: -10, rollDeg: 0 })).toEqual({ angle: 270, magnitude: 10 });
  });
});

/** Poses that point the head at each ring angle in turn, `deg` from center, one frame per 125 ms. */
const sweep = (angles: readonly number[], deg = 15): PoseFrame[] =>
  angles.map((angle, k) => ({
    timeMs: 300 + k * 125,
    pose: { yawDeg: -deg * Math.cos(rad(angle)), pitchDeg: deg * Math.sin(rad(angle)), rollDeg: 0 },
  }));

describe("the arc verifier", () => {
  const quarter: Arc = { from: "right", to: "up", clockwise: false };

  test("a roll along the arc is a hit, timed at the frame that brought it within reach of the end", () => {
    const result = verifyArc(sweep([0, 15, 30, 45, 60, 75, 90, 90]), quarter);
    expect(result).toMatchObject({ verdict: "pass", scores: { hit: true, wrongWayFirst: false, poseMs: 925 } });
    expect(result.scores.yawPeakDeg).toBe(15);
    const circle = verifyArc(sweep(Array.from({ length: 13 }, (_, k) => 90 + k * 30)), {
      from: "up",
      to: "up",
      clockwise: false,
    });
    expect(circle.scores.hit).toBe(true);
  });

  test("a still head, one that stops short, or one already at the end is asked to try again", () => {
    expect(verifyArc(sweep([0, 0, 0, 0], 2), quarter)).toMatchObject({ verdict: "retry", reason: "pose-missed" });
    expect(verifyArc(sweep([0, 20, 40, 50, 50]), quarter).scores.hit).toBe(false);
    expect(verifyArc(sweep([90, 80, 60, 30, 0], 20), quarter).scores.hit).toBe(false);
  });

  test("the opposite sense is noted as the wrong way", () => {
    const wrong = verifyArc(sweep([0, 340, 320, 290, 270]), quarter);
    expect(wrong).toMatchObject({
      verdict: "retry",
      reason: "pose-missed",
      scores: { hit: false, wrongWayFirst: true },
    });
  });

  test("frames without a face don't count, and too few with one can't be judged", () => {
    const frames = sweep([0, 30, 60, 90]);
    const sparse = [...frames, ...frames.map((frame) => ({ ...frame, pose: null }))];
    expect(verifyArc(sparse, quarter).scores.hit).toBe(true);
    expect(verifyArc([...sparse, { timeMs: 2000, pose: null }], quarter)).toMatchObject({
      verdict: "retry",
      reason: "no-face",
      scores: { faceFrames: 4 },
    });
  });
});

describe("the model files", () => {
  test("are refused when their bytes differ from the manifest", async () => {
    const spec = manifest.models.pad;
    const bytes = new Uint8Array(await Bun.file(new URL(`../../models/${spec.file}`, import.meta.url)).arrayBuffer());
    expect(checkedModel(bytes, spec)).toBe(bytes);
    const tampered = bytes.slice();
    const middle = tampered.length >> 1;
    tampered[middle] = tampered[middle]! ^ 0xff;
    expect(() => checkedModel(tampered, spec)).toThrow(/doesn't match/);
    expect(() => checkedModel(bytes.subarray(1), spec)).toThrow(/doesn't match/);
  });

  test("the anti-spoofing crop is 2.7× the face, square, and inside the frame", () => {
    expect(padRegion({ x: 0.45, y: 0.4, w: 0.1, h: 0.1 }, 192)).toEqual({ x: 70, y: 60, span: 52 });
    expect(padRegion({ x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, 192)).toEqual({ x: 0, y: 0, span: 192 });
    expect(padRegion({ x: 0.8, y: 0.0, w: 0.2, h: 0.2 }, 192)).toEqual({ x: 88, y: 0, span: 104 });
  });
});

const poseCapture = (label: AttackLabel, seed: number) => {
  const s = scenario(label, seed);
  const capture = renderCapture(s, scheduleFor(s));
  return {
    arc: capture.pose.arc,
    capture: {
      times: capture.pose.times,
      pixels: capture.pose.pixels,
      frameCount: capture.pose.times.length,
      side: KEY_CROP,
      source: capture.source,
    },
  };
};

describe("the face mesh on synthetic heads", () => {
  // Seeds 2 and 4 draw the parametric ellipsoid, which the mesh reads as a face at every angle.
  const seeds = [2, 4];
  const judge = async (label: AttackLabel, seed: number) => {
    const { arc, capture } = poseCapture(label, seed);
    return meshGeometry.analyze(capture, arc, performance.now() + 10_000);
  };

  test("a head that rolls along the ring is a hit; a still head, the wrong way, or a flat print is not", async () => {
    for (const seed of seeds) {
      const genuine = await judge("genuine", seed);
      expect(genuine).toMatchObject({ verdict: "pass", scores: { hit: true } });
      expect(genuine.scores.faceFrames).toBe(genuine.faces.length);
      expect(genuine.scores.yawPeakDeg).toBeGreaterThan(GEOMETRY.minTurnDeg);
      expect(genuine.faces[0]).toMatchObject({ w: expect.any(Number) });
      for (const label of ["pose-static", "pose-wrong", "pose-flat-turn"] as const) {
        const result = await judge(label, seed);
        expect(result.verdict).not.toBe("pass");
        expect(result.scores.hit).toBe(false);
      }
    }
  }, 20_000);

  test("a frame without a face has no mesh", async () => {
    const scratch = meshScratch();
    expect(await detectMesh(new Uint8Array(KEY_CROP * KEY_CROP * 3), KEY_CROP, scratch)).toBeNull();
    scratch.fill(0);
  });

  test("the anti-spoofing model scores a few frames with a face", async () => {
    const { arc, capture } = poseCapture("genuine", 2);
    const geometry = await meshGeometry.analyze(capture, arc, performance.now() + 10_000);
    const pad = await miniFasPad.analyze(capture, geometry.faces, performance.now() + 10_000);
    expect(pad.verdict).toBe("pass");
    expect(pad.scores.frames).toBeGreaterThanOrEqual(1);
    expect(pad.scores.live).toBeGreaterThanOrEqual(0);
    expect(pad.scores.live).toBeLessThanOrEqual(1);
    expect(
      await miniFasPad.analyze(
        capture,
        capture.times.map(() => null),
        performance.now() + 1000,
      ),
    ).toMatchObject({
      verdict: "skip",
    });
  });
});
