import { useEffect, useRef, type RefObject } from "react";
import { useAnimationActive } from "./useAnimationActive";
import { advanceRippleField, createRippleField, disturbRippleField, rippleDotOpacity } from "../utils/ripple-field";

const FRAME_INTERVAL = 1000 / 30;
const TAU = Math.PI * 2;

interface Point {
  x: number;
  y: number;
}

const driftPoint = (): Point => ({ x: 0.12 + Math.random() * 0.76, y: 0.12 + Math.random() * 0.76 });

/**
 * Draw at a bounded resolution without React renders on pointer movement or animation frames.
 * The pointer is tracked on the window, so the field works behind content as a fixed, pointer-transparent layer.
 */
export function useRippleDots(): RefObject<HTMLCanvasElement | null> {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useAnimationActive(canvas);
  const motion = useRef({
    center: { x: 0.5, y: 0.5 },
    target: { x: 0.5, y: 0.5 },
    phase: 0,
    hovering: false,
    glow: 0,
    drift: { from: { x: 0.5, y: 0.5 }, to: { x: 0.5, y: 0.5 }, elapsed: 0, duration: 0 },
  });

  useEffect(() => {
    const element = canvas.current;
    const surface = element?.parentElement;
    const context = element?.getContext("2d");
    if (!element || !surface || !context) {
      return;
    }

    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    const state = motion.current;
    let width = 0;
    let height = 0;
    let field = createRippleField(0, 0);
    let frame = 0;
    let previous = 0;
    let color = getComputedStyle(element).color;

    const draw = (): void => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = color;
      const focus = pointer.matches ? state.target : state.center;
      for (let row = 1; row < field.rows - 1; row++) {
        for (let column = 1; column < field.columns - 1; column++) {
          const x = (column - 0.5) * field.spacing;
          const y = (row - 0.5) * field.spacing;
          const index = row * field.columns + column;
          // Broad waves cross at different angles; pointer wakes interfere with them.
          const swell = active
            ? Math.sin(x * 0.007 + y * 0.005 - state.phase * 0.35) * 0.2 +
              Math.sin(x * -0.004 + y * 0.008 - state.phase * 0.23 + 0.9) * 0.13 +
              Math.sin(x * 0.011 - y * 0.003 - state.phase * 0.44 + 1.7) * 0.07
            : 0;
          const waveHeight = active ? field.heights[index]! + swell : 0;
          const slopeX = active ? field.heights[index + 1]! - field.heights[index - 1]! : 0;
          const slopeY = active ? field.heights[index + field.columns]! - field.heights[index - field.columns]! : 0;
          const distance = Math.hypot(x - focus.x * width, y - focus.y * height);
          // Wave height never changes brightness or size: no bright rings travel through the field.
          context.globalAlpha = rippleDotOpacity(distance, active ? state.glow : 0);
          context.beginPath();
          context.arc(x + slopeX * 3 + swell, y + slopeY * 3 + waveHeight, 1, 0, TAU);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    const resize = (): void => {
      width = surface.clientWidth;
      height = surface.clientHeight;
      // Cap both pixel work and dot count on tall mobile sections and large displays.
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      element.width = Math.ceil(width * ratio);
      element.height = Math.ceil(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      field = createRippleField(width, height);
      color = getComputedStyle(element).color;
      draw();
    };

    const move = (event: PointerEvent): void => {
      if (!pointer.matches || event.pointerType === "touch") {
        return;
      }
      const bounds = surface.getBoundingClientRect();
      state.hovering = true;
      state.target = {
        x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1))),
        y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(bounds.height, 1))),
      };
    };

    const render = (time: number): void => {
      frame = requestAnimationFrame(render);
      if (previous && time - previous < FRAME_INTERVAL) {
        return;
      }
      const elapsed = previous ? Math.min(time - previous, 64) : FRAME_INTERVAL;
      previous = time;
      state.phase += elapsed / 1000;
      const targetGlow = !pointer.matches || state.hovering ? 1 : 0;
      state.glow += (targetGlow - state.glow) * (1 - Math.exp(-elapsed / 180));
      const from = { x: state.center.x * width, y: state.center.y * height };
      if (pointer.matches) {
        const follow = 1 - Math.exp(-elapsed / 100);
        state.center.x += (state.target.x - state.center.x) * follow;
        state.center.y += (state.target.y - state.center.y) * follow;
      } else {
        const drift = state.drift;
        if (drift.elapsed >= drift.duration) {
          drift.from = { ...state.center };
          drift.to = driftPoint();
          drift.elapsed = 0;
          drift.duration = 16_000 + Math.random() * 10_000;
        }
        drift.elapsed += elapsed;
        const progress = (1 - Math.cos(Math.min(1, drift.elapsed / drift.duration) * Math.PI)) / 2;
        state.center.x = drift.from.x + (drift.to.x - drift.from.x) * progress;
        state.center.y = drift.from.y + (drift.to.y - drift.from.y) * progress;
        state.target = { ...state.center };
      }
      disturbRippleField(field, from, { x: state.center.x * width, y: state.center.y * height });
      advanceRippleField(field);
      draw();
    };

    const changePointer = (): void => {
      state.drift.duration = 0;
      state.target = { ...state.center };
    };

    const leave = (): void => {
      state.hovering = false;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    if (active) {
      window.addEventListener("pointermove", move, { passive: true });
      document.documentElement.addEventListener("pointerleave", leave, { passive: true });
      pointer.addEventListener("change", changePointer);
      frame = requestAnimationFrame(render);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      pointer.removeEventListener("change", changePointer);
    };
  }, [active]);

  return canvas;
}
