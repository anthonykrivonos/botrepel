import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { adapterOf } from "../../lib/db";
import type { LivenessCalibration } from "../../lib/liveness/calibration";
import { createTestApp } from "../helpers";

const app = createTestApp();
const previous = process.env.ADMIN_EMAILS;

beforeAll(async () => {
  process.env.ADMIN_EMAILS = "Operator@example.com";
  await app.migrate();
  const adapter = await adapterOf(app.auth);
  const day = new Date().toISOString().slice(0, 10);
  for (const [decision, correlationE4] of [
    ["pass", 9_700],
    ["pass", 9_500],
    ["fail", 7_800],
  ] as const) {
    await adapter.create({
      model: "livenessStat",
      data: {
        day,
        decision,
        reason: null,
        correlationE4,
        lagMs: 0,
        gainSpreadE4: 300,
        depthE4: 500,
        brightness: 120,
        frames: 60,
        whiteBalanceLocked: true,
        exposureLocked: true,
      },
    });
  }
});
afterAll(() => {
  process.env.ADMIN_EMAILS = previous;
});

describe("/admin/liveness", () => {
  test("only a listed operator can read score distributions", async () => {
    const customer = await app.signIn("customer@example.com");
    await expect(app.query("admin.liveness", { days: 30 }, customer)).rejects.toThrow("operators");

    const operator = await app.signIn("operator@example.com");
    const calibration = await app.query<LivenessCalibration>("admin.liveness", { days: 30 }, operator);
    expect(calibration.total).toBe(3);
    expect(calibration.outcomes).toEqual([
      { decision: "pass", reason: null, count: 2 },
      { decision: "fail", reason: null, count: 1 },
    ]);
    const correlation = calibration.metrics.find((metric) => metric.metric === "correlation")!;
    expect(correlation.byDecision.pass).toEqual([0.95, 0.95, 0.95, 0.97, 0.97]);
    expect(correlation.byDecision.fail).toEqual([0.78, 0.78, 0.78, 0.78, 0.78]);
  });
});
