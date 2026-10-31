/**
 * Measures the light check on the synthetic corpus and prints the attack matrix (APCER per attack
 * label, genuine BPCER and retry rate, Wilson bounds, AUC, latency), as injection-attack
 * evaluations report it. Writes a JSON artifact, checks the error budgets, and compares
 * report-only rates against the committed baseline so they can only improve.
 *
 *   bun scripts/liveness-metrics.ts [--size test|pr|nightly] [--seed 1] [--only label,label]
 *     [--json out.json] [--summary summary.md] [--baseline apps/web/tests/fixtures/golden/metrics-baseline.json]
 *     [--write-baseline] [--bench] [--models]
 *
 * `--models` runs the pose stages (face mesh and anti-spoofing) too; by default only the flash stage
 * judges, as the committed baseline was measured.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { THRESHOLDS } from "../apps/web/lib/liveness/heuristic";
import { meshGeometry } from "../apps/web/lib/liveness/models/geometry";
import { miniFasPad } from "../apps/web/lib/liveness/models/pad";
import { RATCHET_TOLERANCE, SIZES, type CorpusSize } from "../apps/web/tests/fixtures/budgets";
import {
  checkBudgets,
  checkRatchet,
  composedAnalyze,
  formatMatrix,
  runCorpus,
  summarize,
  type Metrics,
} from "../apps/web/tests/fixtures/metrics";
import { ATTACK_LABELS, corpus, corpusHash, type AttackLabel } from "../apps/web/tests/fixtures/synth-scene";

const BASELINE = resolve(import.meta.dir, "../apps/web/tests/fixtures/golden/metrics-baseline.json");

interface Artifact {
  readonly generatedAt: string;
  readonly bunVersion: string;
  readonly size: CorpusSize;
  readonly seed: number;
  readonly corpusHash: string;
  readonly thresholds: typeof THRESHOLDS;
  readonly metrics: Metrics;
}

const { values } = parseArgs({
  options: {
    size: { type: "string", default: "pr" },
    seed: { type: "string", default: "1" },
    only: { type: "string" },
    json: { type: "string" },
    summary: { type: "string" },
    baseline: { type: "string" },
    "write-baseline": { type: "boolean", default: false },
    bench: { type: "boolean", default: false },
    models: { type: "boolean", default: false },
  },
});

const size = values.size as CorpusSize;
if (!(size in SIZES)) {
  console.error(`--size must be one of ${Object.keys(SIZES).join(", ")}`);
  process.exit(2);
}
const seed = Number(values.seed);
const only = values.only?.split(",").map((label) => label.trim()) as AttackLabel[] | undefined;
for (const label of only ?? []) {
  if (!ATTACK_LABELS.includes(label)) {
    console.error(`Unknown label ${label}; labels: ${ATTACK_LABELS.join(", ")}`);
    process.exit(2);
  }
}

const counts = only ? Object.fromEntries(only.map((label) => [label, SIZES[size][label] ?? 0])) : SIZES[size];
const scenarios = corpus(seed, counts);
const started = performance.now();
const rows = await runCorpus(
  composedAnalyze(values.models ? { geometry: meshGeometry, pad: miniFasPad } : {}),
  scenarios,
);
const metrics = summarize(rows);
const artifact: Artifact = {
  generatedAt: new Date().toISOString(),
  bunVersion: Bun.version,
  size,
  seed,
  corpusHash: corpusHash(scenarios),
  thresholds: THRESHOLDS,
  metrics,
};

const table = formatMatrix(metrics);
console.log(
  `Corpus ${size} (seed ${seed}, ${scenarios.length} captures, hash ${artifact.corpusHash}) in ${((performance.now() - started) / 1000).toFixed(1)} s\n`,
);
console.log(table);
if (values.bench) {
  console.log(
    `\nrender p50 ${metrics.latencyMs.renderP50.toFixed(1)} ms, analyze p50 ${metrics.latencyMs.analyzeP50.toFixed(1)} ms, analyze p95 ${metrics.latencyMs.analyzeP95.toFixed(1)} ms`,
  );
}

const write = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
if (values.json) {
  write(values.json, JSON.stringify(artifact, null, 2) + "\n");
}
if (values.summary) {
  write(values.summary, `## Light check metrics (${size}, seed ${seed})\n\n${table}\n`);
}

let failed = false;
const budget = checkBudgets(metrics);
if (budget.length) {
  failed = true;
  console.error(`\nBudget breaches:\n- ${budget.join("\n- ")}`);
}
const baselinePath = values.baseline ?? (values["write-baseline"] ? undefined : BASELINE);
if (baselinePath) {
  let baseline: Artifact | null = null;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Artifact;
  } catch {
    console.warn(`\nNo baseline at ${baselinePath}; run with --write-baseline to create one.`);
  }
  if (baseline) {
    const regressions = checkRatchet(metrics, baseline.metrics, RATCHET_TOLERANCE);
    if (regressions.length) {
      failed = true;
      console.error(
        `\nRegressions against the baseline (${baseline.size}, ${baseline.generatedAt}):\n- ${regressions.join("\n- ")}`,
      );
    } else {
      console.log(`\nNo regressions against the baseline (${baseline.size}, ${baseline.generatedAt}).`);
    }
  }
}
if (values["write-baseline"]) {
  write(
    BASELINE,
    JSON.stringify(
      { ...artifact, metrics: { ...metrics, latencyMs: { renderP50: 0, analyzeP50: 0, analyzeP95: 0 } } },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nBaseline written to ${BASELINE}`);
}
process.exit(failed ? 1 : 0);
