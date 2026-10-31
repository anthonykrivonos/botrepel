import { useEffect, useRef } from "react";
import { FACES, FACE_STEP, type FacePoint, facePath, parseFace } from "../shared/face";
import type { Rgb } from "../shared/liveness";
import { type FaceMix, dissolveOrder, faceMix } from "../utils/faceCycle";
import { sentColor } from "../utils/light";
import { type Spring, stepSpring } from "../utils/spring";

const LEVELS = 24;
/** How far behind the sent light the reflection is drawn: a real face answers within one frame. */
const REFLECTION_LAG_S = 0.034;
const HISTORY = 240;
const STILL_TIME_S = 1.7;
/** How often the ambient light around the stage follows the canvas, in frames. */
const AMBIENT_EVERY = 3;
/** The farthest the head turns, in radians, whether drifting or following the pointer. */
const MAX = { yaw: 0.26, pitch: 0.07, roll: 0.04 } as const;
/** Long gaps (a hidden tab, a slow frame) step the springs at most this far, so nothing jumps. */
const MAX_STEP_S = 1 / 30;

type Pose = Record<keyof typeof MAX, number>;

/** The slow drift the head follows on its own. */
const idlePose = (t: number): Pose => ({
  yaw: MAX.yaw * Math.sin(t * 0.31),
  pitch: MAX.pitch * Math.sin(t * 0.19),
  roll: MAX.roll * Math.sin(t * 0.23),
});

const clampUnit = (value: number): number => Math.min(1, Math.max(-1, value));

/** The screen sits a little above and left of the eyes, so the features catch its light. */
const LIGHT = (() => {
  const [x, y, z] = [-0.28, 0.32, 0.9];
  const size = Math.hypot(x, y, z);
  return { x: x / size, y: y / size, z: z / size };
})();

const skinTone = ([r, g, b]: Rgb, white: number): Rgb => [
  r + (255 - r) * white,
  g + (255 - g) * white,
  b + (255 - b) * white,
];

const css = ([r, g, b]: Rgb, scale = 1): string =>
  `rgb(${Math.round(r * scale)} ${Math.round(g * scale)} ${Math.round(b * scale)})`;

/**
 * The hero's figure: synthetic faces (public/faces/, from MakeHuman's CC0 mesh) lit by a screen
 * whose color drifts like the flash check's schedule. Each face holds, then dissolves dot by dot
 * into the next.
 * Brightness follows how each point faces the screen (the geometry the check measures), and the
 * strips below show the sent light and its reflection arriving a frame later. The nearest
 * `[data-light]` ancestor gets the current color as `--light`, for the `glow-light` wash. It starts
 * on a random face. The head turns and tilts toward the pointer anywhere on the page, on springs,
 * so it moves smoothly and keeps its momentum when the pointer leaves the page, then eases back
 * into its drift.
 */
export function LightStage({ className }: { readonly className?: string }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    /** Each face's points with their dissolve order, once loaded. */
    const faces: ({ points: FacePoint[]; order: Float32Array } | undefined)[] = FACES.map(() => undefined);
    const host = canvas.closest<HTMLElement>("[data-light]");
    let drawn = 0;
    // Starts full, as if the screen had been lit for a while already.
    const history: Rgb[] = Array.from({ length: HISTORY }, (_, index) => sentColor((index - HISTORY) / 60));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = true;
    const started = performance.now();
    const first = Math.floor(Math.random() * FACES.length);

    const resize = (): void => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
    };

    const springs: Record<keyof Pose, Spring> = {
      yaw: { value: 0, velocity: 0 },
      pitch: { value: 0, velocity: 0 },
      roll: { value: 0, velocity: 0 },
    };
    /** The pointer relative to the face's center, from -1 to 1 across the viewport, or null off the page. */
    let pointer: { x: number; y: number } | null = null;
    let last = 0;

    /** The mix at `t`, holding on the current face until the next one has loaded. */
    const mixAt = (t: number): FaceMix => {
      const mix = faceMix(t, FACES.length, first);
      return faces[mix.to] ? mix : { from: mix.from, to: mix.from, progress: 0 };
    };

    const draw = (t: number, pose: Pose = idlePose(t), mix: FaceMix = mixAt(t)): void => {
      const { width, height } = canvas;
      const ratio = width / Math.max(1, canvas.clientWidth);
      const sent = sentColor(t);
      history.push(sent);
      if (history.length > HISTORY) {
        history.shift();
      }
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);

      // The screen's light falling on the scene.
      const glow = context.createRadialGradient(width / 2, height * 0.41, 0, width / 2, height * 0.41, width * 0.7);
      glow.addColorStop(0, css(sent, 0.16));
      glow.addColorStop(1, "rgb(0 0 0 / 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const { yaw, pitch, roll } = pose;
      const [cy, sy] = [Math.cos(yaw), Math.sin(yaw)];
      const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)];
      const [cr, sr] = [Math.cos(roll), Math.sin(roll)];
      const scale = Math.min(width * 0.38, height * 0.3);
      const centerX = width / 2;
      const centerY = height * 0.41;
      const size = Math.max(1, FACE_STEP * scale * 0.95);
      const lit = sentColor(t - REFLECTION_LAG_S);
      if (host && drawn++ % AMBIENT_EVERY === 0) {
        host.style.setProperty("--light", lit.map(Math.round).join(" "));
      }
      const buckets: number[][] = Array.from({ length: LEVELS }, () => []);
      // While dissolving, a point shows on the outgoing face until the progress passes its order,
      // then on the incoming face; both faces share one grid, so each dot swaps in place.
      const showing = [
        { face: faces[mix.from], keep: (order: number): boolean => mix.from === mix.to || order >= mix.progress },
        {
          face: mix.from === mix.to ? undefined : faces[mix.to],
          keep: (order: number): boolean => order < mix.progress,
        },
      ];
      for (const { face, keep } of showing) {
        if (!face) {
          continue;
        }
        for (const [index, p] of face.points.entries()) {
          if (!keep(face.order[index]!)) {
            continue;
          }
          const x0 = p.x * cy + p.z * sy;
          const z1 = -p.x * sy + p.z * cy;
          const y0 = p.y * cp - z1 * sp;
          const x = x0 * cr - y0 * sr;
          const y = x0 * sr + y0 * cr;
          const nx0 = p.nx * cy + p.nz * sy;
          const nz1 = -p.nx * sy + p.nz * cy;
          const ny0 = p.ny * cp - nz1 * sp;
          const nz = nz1 * cp + p.ny * sp;
          const nx = nx0 * cr - ny0 * sr;
          const ny = nx0 * sr + ny0 * cr;
          // Lambert shading toward the screen with a little ambient fill, a faint glint, times the albedo.
          const facing = Math.max(0, nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);
          const light = (0.14 + 0.86 * facing ** 1.4 + 0.12 * facing ** 30) * p.albedo;
          const level = Math.min(LEVELS - 1, Math.floor(light * LEVELS));
          buckets[level]!.push(centerX + x * scale, centerY - y * scale);
        }
      }
      for (const [level, coordinates] of buckets.entries()) {
        // Bright surfaces lean toward white, so the face looks lit by colored light rather than made of it.
        const brightness = 0.05 + 0.95 * ((level + 0.5) / LEVELS) ** 0.8;
        context.fillStyle = css(skinTone(lit, 0.35 * brightness), brightness);
        for (let index = 0; index < coordinates.length; index += 2) {
          context.fillRect(coordinates[index]!, coordinates[index + 1]!, size, size);
        }
      }

      // Sent and reflected strips: the reflection trails by the lag and carries less light.
      const stripLeft = width * 0.08;
      const stripWidth = width * 0.84;
      const stripHeight = Math.max(4, height * 0.018);
      const sentTop = height * 0.83;
      const reflectedTop = sentTop + stripHeight + 18 * ratio;
      const cell = stripWidth / HISTORY;
      context.font = `${10 * ratio}px "Geist Mono", ui-monospace, monospace`;
      context.fillStyle = "#8a8f93";
      context.fillText("SENT", stripLeft, sentTop - 4 * ratio);
      context.fillText("REFLECTED", stripLeft, reflectedTop - 4 * ratio);
      const lagCells = Math.round(REFLECTION_LAG_S * 60);
      for (const [index, color] of history.entries()) {
        const x = stripLeft + (HISTORY - history.length + index) * cell;
        context.fillStyle = css(color);
        context.fillRect(x, sentTop, cell + 0.5, stripHeight);
        const echo = history[index - lagCells];
        if (echo) {
          context.fillStyle = css(echo, 0.55);
          context.fillRect(x, reflectedTop, cell + 0.5, stripHeight);
        }
      }
    };

    const tick = (now: number): void => {
      const dt = Math.min(MAX_STEP_S, Math.max(0, (now - last) / 1000));
      last = now;
      if (visible && document.visibilityState === "visible") {
        const t = (now - started) / 1000;
        // Turn toward the pointer (up is negative pitch) and tilt toward its side (a clockwise roll
        // for the right); without one, follow the drift.
        const target: Pose = pointer
          ? { yaw: MAX.yaw * pointer.x, pitch: MAX.pitch * pointer.y, roll: -MAX.roll * pointer.x }
          : idlePose(t);
        for (const key of Object.keys(springs) as (keyof Pose)[]) {
          springs[key] = stepSpring(springs[key], target[key], dt, MAX[key]);
        }
        draw(t, { yaw: springs.yaw.value, pitch: springs.pitch.value, roll: springs.roll.value });
      }
      frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent): void => {
      // A touch only moves while scrolling; phones keep the drift.
      if (event.pointerType === "touch") {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointer = {
        x: clampUnit((event.clientX - rect.left - rect.width / 2) / (window.innerWidth / 2)),
        y: clampUnit((event.clientY - rect.top - rect.height * 0.41) / (window.innerHeight / 2)),
      };
    };
    const onPointerLeave = (): void => {
      pointer = null;
    };

    resize();
    // The starting face loads first; with reduced motion, it's the only one shown.
    const load = async (index: number): Promise<void> => {
      const response = await fetch(facePath(FACES[index]!));
      if (!response.ok) {
        return;
      }
      const points = parseFace(await response.arrayBuffer());
      faces[index] = { points, order: Float32Array.from(points, (p, at) => dissolveOrder(at, p.y)) };
    };
    void load(first)
      .then(async () => {
        if (still) {
          draw(STILL_TIME_S);
          return;
        }
        await Promise.all(FACES.map((_, index) => (index === first ? undefined : load(index))));
      })
      .catch(() => undefined);
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (still) {
        draw(STILL_TIME_S);
      }
    });
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    visibility.observe(canvas);
    if (still) {
      for (let t = STILL_TIME_S - HISTORY / 60; t <= STILL_TIME_S; t += 1 / 60) {
        draw(t);
      }
    } else {
      // Start the springs on the drift, so the first frames don't swing in from straight ahead.
      const start = idlePose(0);
      for (const key of Object.keys(springs) as (keyof Pose)[]) {
        springs[key] = { value: start[key], velocity: 0 };
      }
      last = performance.now();
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      resizeObserver.disconnect();
      visibility.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
