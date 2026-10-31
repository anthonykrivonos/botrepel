/**
 * The marketing figures' stand-in for the flash check's light: smooth and deterministic, so
 * pre-rendered and hydrated frames agree. Real schedules are random and made on the server.
 */
import { colorAt, type Rgb, type Schedule } from "../shared/liveness";

/** The hues the flash check uses: yellow to magenta the long way round, never saturated red. */
const PALETTE: Schedule = {
  stepMs: 1,
  colors: [
    [255, 214, 0],
    [40, 230, 120],
    [0, 210, 230],
    [60, 110, 255],
    [230, 60, 230],
  ],
};

/** The screen's color at time `t` seconds: three slow waves (all under 3 Hz) and an occasional dark dip. */
export function sentColor(t: number): Rgb {
  const wave =
    (Math.sin(2 * Math.PI * 0.21 * t + 0.4) +
      0.7 * Math.sin(2 * Math.PI * 0.53 * t + 2.1) +
      0.5 * Math.sin(2 * Math.PI * 0.89 * t + 4.3)) /
    2.2;
  const [r, g, b] = colorAt(PALETTE, (wave * 0.5 + 0.5) * (PALETTE.colors.length - 1));
  const phase = t % 3.7;
  const dim = phase > 3.3 ? 0.25 + (0.75 * Math.abs(phase - 3.5)) / 0.2 : 1;
  return [r * dim, g * dim, b * dim];
}
