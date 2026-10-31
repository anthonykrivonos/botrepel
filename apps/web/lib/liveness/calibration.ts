import { FUSION } from "./fusion";
import { THRESHOLDS } from "./heuristic";
import { SPECULAR } from "./specular";
import type { Sql } from "../db";

/** Enough rows to tune on, few enough to sort in one request. */
const MAX_ROWS = 20_000;
const QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95] as const;

interface StatRow {
  readonly decision: string;
  readonly reason: string | null;
  readonly correlationE4: number;
  readonly lagMs: number | null;
  readonly gainSpreadE4: number;
  readonly depthE4: number;
  readonly brightness: number;
  readonly dipCorrelationE4: number | null;
  readonly specularMeasured: boolean | null;
  readonly specularE4: number | null;
  readonly stallMs: number | null;
  readonly motionE4: number | null;
  readonly skinRgE4: number | null;
  readonly skinBgE4: number | null;
  readonly injectionE4: number | null;
  readonly riskE4: number | null;
  readonly padLiveE4: number | null;
  readonly poseMs: number | null;
  readonly yawPeakDeg: number | null;
  readonly judgeLiveE4: number | null;
  readonly analysisMs: number | null;
}

export interface MetricSummary {
  readonly metric: string;
  /** The threshold the heuristic applies now, for comparison. */
  readonly threshold: string;
  /** Quantiles (5th, 25th, 50th, 75th, 95th) per decision. */
  readonly byDecision: Readonly<Record<string, readonly number[]>>;
}

export interface LivenessCalibration {
  readonly since: string;
  readonly total: number;
  /** True when more rows matched than were read; the newest are summarized. */
  readonly truncated: boolean;
  readonly outcomes: readonly { readonly decision: string; readonly reason: string | null; readonly count: number }[];
  readonly metrics: readonly MetricSummary[];
  /** How many rows each optional layer measured, so a layer that never runs is visible. */
  readonly coverage: {
    readonly specularMeasured: number;
    readonly padRan: number;
    readonly judgeRan: number;
    readonly poseSubmitted: number;
  };
}

/** Absent measurements are NaN, which the quantiles drop (`Number(null)` would be a silent 0). */
const optional = (value: unknown): number => (value === null || value === undefined ? Number.NaN : Number(value));

const METRICS: readonly { metric: string; threshold: string; value: (row: StatRow) => number }[] = [
  { metric: "correlation", threshold: `≥ ${THRESHOLDS.minCorrelation}`, value: (row) => row.correlationE4 / 10_000 },
  { metric: "gain spread", threshold: `≥ ${THRESHOLDS.minGainSpread}`, value: (row) => row.gainSpreadE4 / 10_000 },
  { metric: "depth", threshold: `≥ ${THRESHOLDS.minDepth}`, value: (row) => row.depthE4 / 10_000 },
  {
    metric: "lag (ms)",
    threshold: `${THRESHOLDS.minLagMs} to ${THRESHOLDS.maxLagMs}`,
    value: (row) => row.lagMs ?? Number.NaN,
  },
  {
    metric: "brightness",
    threshold: `${THRESHOLDS.minBrightness} to ${THRESHOLDS.maxBrightness}`,
    value: (row) => row.brightness,
  },
  {
    metric: "dip correlation",
    threshold: `≥ ${THRESHOLDS.minDipCorrelation}`,
    value: (row) => optional(row.dipCorrelationE4) / 10_000,
  },
  {
    metric: "specular gain",
    threshold: `≥ ${SPECULAR.minGain} (measured rows)`,
    value: (row) => optional(row.specularE4) / 10_000,
  },
  { metric: "stall (ms)", threshold: `≤ ${THRESHOLDS.maxStallTotalMs}`, value: (row) => optional(row.stallMs) },
  {
    metric: "motion",
    threshold: `< ${THRESHOLDS.maxMotion} to fail rather than retry`,
    value: (row) => optional(row.motionE4) / 10_000,
  },
  { metric: "skin red share", threshold: "0.3 to 0.62 for skin", value: (row) => optional(row.skinRgE4) / 10_000 },
  { metric: "skin blue share", threshold: "0.1 to 0.36 for skin", value: (row) => optional(row.skinBgE4) / 10_000 },
  { metric: "injection", threshold: "adds to risk", value: (row) => optional(row.injectionE4) / 10_000 },
  { metric: "risk", threshold: `< ${FUSION.riskFail}`, value: (row) => optional(row.riskE4) / 10_000 },
  {
    metric: "PAD live",
    threshold: `≥ ${FUSION.padSoft} soft, ≥ ${FUSION.padHardFail} hard`,
    value: (row) => optional(row.padLiveE4) / 10_000,
  },
  { metric: "pose (ms)", threshold: `≤ ${FUSION.strictPoseMs} for an anchor`, value: (row) => optional(row.poseMs) },
  { metric: "yaw peak (deg)", threshold: "≥ 15 for a turn", value: (row) => optional(row.yawPeakDeg) },
  {
    metric: "judge live",
    threshold: `≥ ${FUSION.judgeStrictLive} for an anchor`,
    value: (row) => optional(row.judgeLiveE4) / 10_000,
  },
  { metric: "analysis (ms)", threshold: "budget 3000", value: (row) => optional(row.analysisMs) },
];

/** Nearest-rank quantiles of `values`, which this sorts. */
export function quantiles(values: number[]): number[] {
  values.sort((a, b) => a - b);
  return values.length === 0
    ? []
    : QUANTILES.map((q) => values[Math.min(values.length - 1, Math.max(0, Math.ceil(q * values.length) - 1))]!);
}

/** Score distributions of recent light checks, for tuning THRESHOLDS on real devices. */
export async function livenessCalibration(sql: Sql, sinceDay: string): Promise<LivenessCalibration> {
  const rows = (
    await sql.all<StatRow>(
      `SELECT "decision", "reason", "correlationE4", "lagMs", "gainSpreadE4", "depthE4", "brightness",
              "dipCorrelationE4", "specularMeasured", "specularE4", "stallMs", "motionE4", "skinRgE4", "skinBgE4", "injectionE4", "riskE4",
              "padLiveE4", "poseMs", "yawPeakDeg", "judgeLiveE4", "analysisMs"
       FROM "livenessStat" WHERE "day" >= ? ORDER BY "day" DESC LIMIT ${MAX_ROWS + 1}`,
      [sinceDay],
    )
  ).map((row) => ({
    ...row,
    correlationE4: Number(row.correlationE4),
    lagMs: row.lagMs === null ? null : Number(row.lagMs),
    gainSpreadE4: Number(row.gainSpreadE4),
    depthE4: Number(row.depthE4),
    brightness: Number(row.brightness),
  }));
  const truncated = rows.length > MAX_ROWS;
  const sample = rows.slice(0, MAX_ROWS);

  const counts = new Map<string, { decision: string; reason: string | null; count: number }>();
  for (const row of sample) {
    const key = `${row.decision}:${row.reason ?? ""}`;
    const entry = counts.get(key) ?? { decision: row.decision, reason: row.reason, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  const decisions = [...new Set(sample.map((row) => row.decision))].sort();
  const present = (value: unknown): boolean => value !== null && value !== undefined;
  return {
    since: sinceDay,
    total: sample.length,
    truncated,
    outcomes: [...counts.values()].sort((a, b) => b.count - a.count),
    coverage: {
      specularMeasured: sample.filter((row) => row.specularMeasured === true || Number(row.specularMeasured) === 1)
        .length,
      padRan: sample.filter((row) => present(row.padLiveE4)).length,
      judgeRan: sample.filter((row) => present(row.judgeLiveE4)).length,
      poseSubmitted: sample.filter((row) => row.decision !== "pending").length,
    },
    metrics: METRICS.map(({ metric, threshold, value }) => ({
      metric,
      threshold,
      byDecision: Object.fromEntries(
        decisions.map((decision) => [
          decision,
          // Rows from before a metric was recorded have none (NaN), so they don't count.
          quantiles(
            sample
              .filter((row) => row.decision === decision)
              .map(value)
              .filter(Number.isFinite),
          ),
        ]),
      ),
    })),
  };
}
