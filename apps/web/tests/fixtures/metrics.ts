/**
 * Runs a corpus through the analyzer and summarizes the outcome the way injection-attack
 * evaluations report it: an attack-label matrix with APCER, genuine BPCER and retry rate, score
 * distributions, a lag histogram, and session AUC. Shared by the metrics script and the budget test.
 */
import { BUDGETS } from "./budgets";
import { seededRandom, renderCapture, type AttackLabel, type Scenario, type SyntheticCapture } from "./synth-scene";
import type { LivenessDecision } from "../../lib/liveness/analyzer";
import { quantiles } from "../../lib/liveness/calibration";
import { composeAnalyzer, type AnalyzerParts } from "../../lib/liveness/compose";
import { fuse } from "../../lib/liveness/fusion";
import { asFlashCapture, heuristicFlash } from "../../lib/liveness/heuristic";
import { injectionScore } from "../../lib/liveness/injection";
import { newSchedule } from "../../lib/liveness/schedule";
import { KEY_CROP, type LivenessRetry, type Schedule } from "../../src/shared/liveness";

/** What the harness drives: the flash-only decision, or the fused verdict with its risk. */
export interface Judged {
  readonly kind: LivenessDecision["kind"];
  readonly reason?: LivenessRetry;
  readonly scores: LivenessDecision["scores"];
  readonly risk?: number;
}
export type Analyze = (capture: SyntheticCapture, schedule: Schedule) => Judged | Promise<Judged>;

/** The production path: flash stage, injection scoring, pose stages (fakes or none), fusion. */
export function composedAnalyze(parts: Partial<AnalyzerParts> = {}): Analyze {
  const analyzer = composeAnalyzer({ flash: heuristicFlash, geometry: null, pad: null, judge: null, ...parts });
  return async (capture, schedule) => {
    const full = asFlashCapture(capture);
    const flash = await analyzer.flash(full, { schedule, paintTimes: full.paintTimes });
    const injection = injectionScore(full.source, full);
    const pose = await analyzer.pose(
      {
        times: capture.pose.times,
        pixels: capture.pose.pixels,
        frameCount: capture.pose.times.length,
        side: KEY_CROP,
        source: full.source,
      },
      capture.pose.arc,
    );
    const verdict = fuse({ flash, injection, geometry: pose.geometry, pad: pose.pad, judge: null, continuity: null });
    const { correlation, lagMs, gainSpread, depth, brightness, skinLike } = flash.scores;
    return {
      kind: verdict.kind,
      ...(verdict.kind === "retry" ? { reason: verdict.reason } : {}),
      scores: { correlation, lagMs, gainSpread, depth, brightness, skinLike },
      risk: verdict.scores.risk,
    };
  };
}

export interface RunRow {
  readonly id: string;
  readonly label: AttackLabel;
  readonly decision: LivenessDecision["kind"];
  readonly reason?: string;
  readonly scores: LivenessDecision["scores"];
  /** A scalar confidence that the capture is genuine, for AUC: correlation less the fused risk. */
  readonly fused: number;
  readonly risk: number;
  readonly renderMs: number;
  readonly analyzeMs: number;
}

export interface LabelSummary {
  readonly n: number;
  readonly pass: number;
  readonly retry: number;
  readonly fail: number;
  /** Attacks: share accepted. */
  readonly apcer?: number;
  /** Genuine: share rejected outright, and share asked to retry. */
  readonly bpcerFail?: number;
  readonly retryRate?: number;
  /** Wilson 95% upper bound of the headline rate, so 0 of 4 is never mistaken for 0%. */
  readonly wilsonUpper: number;
  readonly retryReasons: Readonly<Record<string, number>>;
}

export interface Metrics {
  readonly byLabel: Readonly<Partial<Record<AttackLabel, LabelSummary>>>;
  /** Per score, per label: 5th, 25th, 50th, 75th, 95th percentiles. */
  readonly distributions: Readonly<Record<string, Readonly<Partial<Record<AttackLabel, readonly number[]>>>>>;
  /** Measured lag per label in 10 ms bins from -100 to 400 ms. */
  readonly lagHistogram: Readonly<Partial<Record<AttackLabel, readonly number[]>>>;
  /** Genuine versus every attack, and versus every attack except the physically complete relights. */
  readonly auc: { readonly session: number; readonly sessionExcludingFull: number };
  readonly latencyMs: { readonly renderP50: number; readonly analyzeP50: number; readonly analyzeP95: number };
}

const LAG_BIN_MS = 10;
const LAG_MIN_MS = -100;
const LAG_BINS = 50;

/** The schedule a scenario was shown: seeded by its id, so a run is reproducible. */
export function scheduleFor(scenario: Scenario): Schedule {
  let hash = 2166136261;
  for (const ch of scenario.id) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return newSchedule(seededRandom(hash >>> 0));
}

export async function runCorpus(analyze: Analyze, scenarios: readonly Scenario[]): Promise<RunRow[]> {
  const rows: RunRow[] = [];
  for (const scenario of scenarios) {
    const schedule = scheduleFor(scenario);
    const t0 = performance.now();
    const capture = renderCapture(scenario, schedule);
    const t1 = performance.now();
    const decision = await analyze(capture, schedule);
    const t2 = performance.now();
    rows.push({
      id: scenario.id,
      label: scenario.label,
      decision: decision.kind,
      ...(decision.reason ? { reason: decision.reason } : {}),
      scores: decision.scores,
      fused: decision.scores.correlation - (decision.risk ?? 0),
      risk: decision.risk ?? 0,
      renderMs: t1 - t0,
      analyzeMs: t2 - t1,
    });
  }
  return rows;
}

/** Wilson score interval, upper bound, at 95%. */
export function wilsonUpper(successes: number, n: number): number {
  if (n === 0) {
    return 1;
  }
  const z = 1.96;
  const p = successes / n;
  const denominator = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.min(1, (center + spread) / denominator);
}

/** Mann–Whitney AUC: the chance a random positive scores above a random negative. */
export function auc(positive: readonly number[], negative: readonly number[]): number {
  if (!positive.length || !negative.length) {
    return Number.NaN;
  }
  let wins = 0;
  for (const p of positive) {
    for (const n of negative) {
      wins += p > n ? 1 : p === n ? 0.5 : 0;
    }
  }
  return wins / (positive.length * negative.length);
}

const median = (values: number[]): number => quantiles(values.slice())[2] ?? Number.NaN;

export function summarize(rows: readonly RunRow[]): Metrics {
  const labels = [...new Set(rows.map((row) => row.label))];
  const byLabel: Partial<Record<AttackLabel, LabelSummary>> = {};
  const lagHistogram: Partial<Record<AttackLabel, number[]>> = {};
  const scoreNames = ["correlation", "lagMs", "gainSpread", "depth", "brightness"] as const;
  const distributions: Record<string, Partial<Record<AttackLabel, readonly number[]>>> = Object.fromEntries(
    scoreNames.map((name) => [name, {}]),
  );
  for (const label of labels) {
    const of = rows.filter((row) => row.label === label);
    const count = (kind: RunRow["decision"]): number => of.filter((row) => row.decision === kind).length;
    const pass = count("pass");
    const retry = count("retry");
    const fail = count("fail");
    const retryReasons: Record<string, number> = {};
    for (const row of of) {
      if (row.reason) {
        retryReasons[row.reason] = (retryReasons[row.reason] ?? 0) + 1;
      }
    }
    byLabel[label] =
      label === "genuine"
        ? {
            n: of.length,
            pass,
            retry,
            fail,
            bpcerFail: fail / of.length,
            retryRate: retry / of.length,
            wilsonUpper: wilsonUpper(fail, of.length),
            retryReasons,
          }
        : {
            n: of.length,
            pass,
            retry,
            fail,
            apcer: pass / of.length,
            wilsonUpper: wilsonUpper(pass, of.length),
            retryReasons,
          };
    const bins = new Array<number>(LAG_BINS).fill(0);
    for (const row of of) {
      const bin = Math.floor((row.scores.lagMs - LAG_MIN_MS) / LAG_BIN_MS);
      if (bin >= 0 && bin < LAG_BINS) {
        bins[bin]!++;
      }
    }
    lagHistogram[label] = bins;
    for (const name of scoreNames) {
      distributions[name]![label] = quantiles(of.map((row) => Number(row.scores[name])));
    }
  }
  const genuine = rows.filter((row) => row.label === "genuine").map((row) => row.fused);
  const attacks = rows.filter((row) => row.label !== "genuine");
  return {
    byLabel,
    distributions,
    lagHistogram,
    auc: {
      session: auc(
        genuine,
        attacks.map((row) => row.fused),
      ),
      sessionExcludingFull: auc(
        genuine,
        attacks.filter((row) => !row.label.startsWith("relight-full")).map((row) => row.fused),
      ),
    },
    latencyMs: {
      renderP50: median(rows.map((row) => row.renderMs)),
      analyzeP50: median(rows.map((row) => row.analyzeMs)),
      analyzeP95: quantiles(rows.map((row) => row.analyzeMs))[4] ?? Number.NaN,
    },
  };
}

const percent = (value: number | undefined): string =>
  value === undefined || Number.isNaN(value) ? "—" : `${(value * 100).toFixed(1)}%`;

/** The matrix as a Markdown table (also readable in a terminal). */
export function formatMatrix(metrics: Metrics): string {
  const lines = [
    "| label | n | pass | retry | fail | APCER / BPCER-fail | retry rate | Wilson upper | retry reasons |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [label, s] of Object.entries(metrics.byLabel) as [AttackLabel, LabelSummary][]) {
    const headline = label === "genuine" ? percent(s.bpcerFail) : percent(s.apcer);
    const reasons = Object.entries(s.retryReasons)
      .map(([reason, n]) => `${reason}:${n}`)
      .join(" ");
    lines.push(
      `| ${label} | ${s.n} | ${s.pass} | ${s.retry} | ${s.fail} | ${headline} | ${label === "genuine" ? percent(s.retryRate) : "—"} | ${percent(s.wilsonUpper)} | ${reasons} |`,
    );
  }
  lines.push(
    "",
    `Session AUC ${metrics.auc.session.toFixed(3)} (excluding relight-full: ${metrics.auc.sessionExcludingFull.toFixed(3)}); render p50 ${metrics.latencyMs.renderP50.toFixed(0)} ms, analyze p50 ${metrics.latencyMs.analyzeP50.toFixed(0)} ms, p95 ${metrics.latencyMs.analyzeP95.toFixed(0)} ms`,
  );
  return lines.join("\n");
}

/** Budget breaches, one line each; empty when the corpus is within budget. */
export function checkBudgets(metrics: Metrics): string[] {
  const failures: string[] = [];
  const genuine = metrics.byLabel.genuine;
  if (genuine) {
    if ((genuine.bpcerFail ?? 0) > BUDGETS.genuine.maxFail) {
      failures.push(
        `genuine BPCER-fail ${percent(genuine.bpcerFail)} > ${percent(BUDGETS.genuine.maxFail)} (${genuine.fail}/${genuine.n})`,
      );
    }
    if ((genuine.retryRate ?? 0) > BUDGETS.genuine.maxRetry) {
      failures.push(
        `genuine retry rate ${percent(genuine.retryRate)} > ${percent(BUDGETS.genuine.maxRetry)} (${genuine.retry}/${genuine.n})`,
      );
    }
  }
  for (const [label, summary] of Object.entries(metrics.byLabel) as [AttackLabel, LabelSummary][]) {
    if (label === "genuine") {
      continue;
    }
    const budget = BUDGETS.attacks[label];
    if (budget.maxApcer !== null && (summary.apcer ?? 0) > budget.maxApcer) {
      failures.push(
        `${label} APCER ${percent(summary.apcer)} > ${percent(budget.maxApcer)} (${summary.pass}/${summary.n})`,
      );
    }
  }
  return failures;
}

/** Report-only rates that rose past the baseline by more than the tolerance. */
export function checkRatchet(metrics: Metrics, baseline: Metrics, tolerance: number): string[] {
  const regressions: string[] = [];
  for (const [label, summary] of Object.entries(metrics.byLabel) as [AttackLabel, LabelSummary][]) {
    const before = baseline.byLabel[label];
    if (!before) {
      continue;
    }
    const pairs: [string, number | undefined, number | undefined][] =
      label === "genuine"
        ? [
            ["BPCER-fail", summary.bpcerFail, before.bpcerFail],
            ["retry rate", summary.retryRate, before.retryRate],
          ]
        : [["APCER", summary.apcer, before.apcer]];
    for (const [name, now, then] of pairs) {
      if (now !== undefined && then !== undefined && now > then + tolerance) {
        regressions.push(
          `${label} ${name} ${percent(now)} is above the baseline ${percent(then)} + ${percent(tolerance)}`,
        );
      }
    }
  }
  return regressions;
}
