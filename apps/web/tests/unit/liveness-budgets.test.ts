import { describe, expect, test } from "bun:test";
import { SIZES } from "../fixtures/budgets";
import { checkBudgets, composedAnalyze, runCorpus, scheduleFor, summarize } from "../fixtures/metrics";
import { corpus, renderCapture, scenario } from "../fixtures/synth-scene";

// LIVENESS_CORPUS=nightly runs the large corpus (bun run test:nightly); the default stays fast.
const size = process.env.LIVENESS_CORPUS === "nightly" ? "nightly" : "test";

describe("the synthetic corpus", () => {
  test("renders the same bytes for the same scenario", () => {
    const one = scenario("genuine", 3);
    const a = renderCapture(one, scheduleFor(one));
    const b = renderCapture(one, scheduleFor(one));
    expect(a.times).toEqual(b.times);
    expect(Buffer.from(a.pixels).equals(Buffer.from(b.pixels))).toBe(true);
    expect(Buffer.from(a.pose.pixels).equals(Buffer.from(b.pose.pixels))).toBe(true);
  });

  test(
    "the light check meets its error budgets",
    async () => {
      const rows = await runCorpus(composedAnalyze(), corpus(1, SIZES[size]));
      const metrics = summarize(rows);
      // The whole matrix, so a breach shows its neighbors too.
      expect({ breaches: checkBudgets(metrics), byLabel: metrics.byLabel }).toMatchObject({ breaches: [] });
    },
    size === "nightly" ? 900_000 : 30_000,
  );
});
