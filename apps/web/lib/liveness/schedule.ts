import { cryptoRandom, type Random } from "./random";
import { SCHEDULE_MS, SCHEDULE_STEP_MS, type Rgb, type Schedule } from "../../src/shared/liveness";

/** The hue moves below 3 Hz; the dips ramp over 80 ms. */
const MAX_HUE_HZ = 2.5;
const DIP_RAMP_MS = 80;
const DIP_HOLD_MS = 60;

/** OKLCH (perceptual lightness, chroma, hue in degrees) to sRGB, clamped into gamut. */
function oklchToRgb(lightness: number, chroma: number, hue: number): Rgb {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const encode = (value: number): number => {
    const clamped = Math.min(1, Math.max(0, value));
    return Math.round(255 * (clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055));
  };
  return [encode(linear[0]!), encode(linear[1]!), encode(linear[2]!)];
}

/** Constant perceptual lightness: only the hue moves, so brightness never pulses except in the dips. */
const LIGHTNESS = 0.72;
const MIN_CHROMA = 0.04;
const MAX_CHROMA = 0.13;
const DIP_LIGHTNESS = 0.2;

/**
 * A random slow wave in [-1, 1]: a sum of three sinusoids under MAX_HUE_HZ, stretched to the
 * full range, because a schedule that barely moves gives too little signal.
 */
function randomWave(steps: number, random: Random): number[] {
  const waves = Array.from({ length: 3 }, () => ({
    hz: 0.4 + random() * (MAX_HUE_HZ - 0.4),
    phase: random() * Math.PI * 2,
    weight: 0.5 + random() * 0.5,
  }));
  const raw = Array.from({ length: steps }, (_, step) =>
    waves.reduce(
      (sum, w) => sum + w.weight * Math.sin(2 * Math.PI * w.hz * ((step * SCHEDULE_STEP_MS) / 1000) + w.phase),
      0,
    ),
  );
  const low = Math.min(...raw);
  const high = Math.max(...raw);
  return raw.map((value) => (high > low ? ((value - low) / (high - low)) * 2 - 1 : 0));
}

/**
 * A one-time schedule: at constant perceptual lightness, the hue wanders between yellow and
 * magenta through green and blue (never red) and the chroma rises and falls independently, with one or
 * two short ramped dark dips that give the timing sharp edges. Brightness changes only in the
 * dips, at most two per two seconds, so nothing flashes in the WCAG 2.3.1 sense.
 *
 * `random` is the CSPRNG in production; tests pass a seeded generator for reproducible corpora.
 */
export function newSchedule(random: Random = cryptoRandom): Schedule {
  const steps = Math.round(SCHEDULE_MS / SCHEDULE_STEP_MS);
  const hues = randomWave(steps, random);
  // Chroma moves on its own random wave, so the schedule has two independent dimensions, not one:
  // that halves the odds of an unrelated schedule (a replay) correlating by chance.
  const chromas = randomWave(steps, random);
  const dips = Array.from({ length: 1 + Math.floor(random() * 2) }, (_, index) => {
    // One dip per half, away from the edges, so they never touch.
    const half = SCHEDULE_MS / 2;
    return index * half + 250 + random() * (half - 500);
  });
  const colors: Rgb[] = [];
  for (let step = 0; step < steps; step++) {
    const t = step * SCHEDULE_STEP_MS;
    // OKLCH hue 110° (yellow) to 330° (magenta) the long way round, through green and blue.
    const hue = 220 + hues[step]! * 110;
    const chroma = MIN_CHROMA + ((chromas[step]! + 1) / 2) * (MAX_CHROMA - MIN_CHROMA);
    const dim = dips.reduce((level, center) => {
      const distance = Math.abs(t - center);
      if (distance <= DIP_HOLD_MS / 2) {
        return Math.min(level, 0);
      }
      const ramp = (distance - DIP_HOLD_MS / 2) / DIP_RAMP_MS;
      return ramp < 1 ? Math.min(level, ramp) : level;
    }, 1);
    colors.push(oklchToRgb(DIP_LIGHTNESS + (LIGHTNESS - DIP_LIGHTNESS) * dim, chroma, hue));
  }
  return { stepMs: SCHEDULE_STEP_MS, colors };
}
