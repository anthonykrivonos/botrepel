import { afterEach, beforeAll, describe, expect, setSystemTime, spyOn, test } from "bun:test";
import type { StartedChallenge } from "../../lib/challenges";
import { sqlFor } from "../../lib/db";
import type { GeometryStage } from "../../lib/liveness/analyzer";
import { composeAnalyzer } from "../../lib/liveness/compose";
import { heuristicFlash } from "../../lib/liveness/heuristic";
import { skippedGeometry } from "../../lib/liveness/models/geometry";
import { arcWindowMs, DIRECTIONS, SCHEDULE_MS, STREAM_LEAD_STEPS, type StreamLine } from "../../src/shared/liveness";
import { captureFor, flashBody, poseBody, readSchedule, type StreamedSchedule } from "../fixtures/liveness-client";
import { createTestApp } from "../helpers";
import { solvePow } from "../pow-solver";

// The stream's pacing is a unit concern (stream.test.ts); here it plays instantly. The pose models are
// another (models.test.ts): a test may stand in for the geometry stage, otherwise it is skipped.
let geometry: GeometryStage | null = null;
const app = createTestApp(
  {},
  {
    sleep: async () => {},
    liveness: composeAnalyzer({
      flash: heuristicFlash,
      geometry: {
        analyze: (capture, arc, deadline) =>
          geometry ? geometry.analyze(capture, arc, deadline) : Promise.resolve(skippedGeometry(capture)),
      },
      pad: null,
      judge: null,
    }),
  },
);
let cookie: string;
let siteKey: string;
let siteId: string;
let secretKey: string;

beforeAll(async () => {
  await app.migrate();
  cookie = await app.signIn("liveness@example.com");
  const created = await app.mutation<{ site: { id: string; siteKey: string }; secretKey: string }>(
    "sites.create",
    { name: "Flash", domains: ["acme.com"] },
    cookie,
  );
  ({ siteKey, id: siteId } = created.site);
  secretKey = created.secretKey;
  await app.mutation("sites.update", { siteId, policies: { "*": "liveness" } }, cookie);
});

afterEach(() => setSystemTime());

/** The invisible step, which this site's policy always steps up. */
async function stepUp(): Promise<string> {
  const start = (await (
    await app.call("/v1/challenge/start", { json: { siteKey, action: "signup", hostname: "acme.com" } })
  ).json()) as StartedChallenge;
  const outcome = (await (
    await app.call("/v1/challenge/invisible", { json: { challengeId: start.challengeId, nonce: solvePow(start.pow) } })
  ).json()) as { kind: string; livenessId: string };
  expect(outcome.kind).toBe("stepUp");
  return outcome.livenessId;
}

async function startFlash(livenessId: string): Promise<{ status: number; streamed: StreamedSchedule | null }> {
  const response = await app.call("/v1/liveness/start", { json: { livenessId } });
  return { status: response.status, streamed: response.ok ? await readSchedule(response) : null };
}

const upload = (path: string, livenessId: string, body: Uint8Array<ArrayBuffer>): Promise<Response> =>
  app.api(
    new Request(`http://botrepel.test/v1/liveness/${path}?id=${livenessId}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", origin: "http://botrepel.test" },
      body,
    }),
  );

/** Both uploads for a capture, after the schedule and the pose window have had time to play. */
async function run(
  livenessId: string,
  capture: ReturnType<typeof captureFor>,
  options: { flash?: Uint8Array<ArrayBuffer>; pose?: Uint8Array<ArrayBuffer> } = {},
): Promise<{ flash: Response; pose: Response }> {
  setSystemTime(new Date(Date.now() + SCHEDULE_MS + 500));
  const flash = await upload("submit", livenessId, options.flash ?? flashBody(capture));
  setSystemTime(new Date(Date.now() + arcWindowMs(capture.pose.arc) + 200));
  const pose = await upload("pose", livenessId, options.pose ?? poseBody(capture));
  return { flash, pose };
}

describe("the schedule stream", () => {
  test("sends the colors in order, one step ahead of its beat, then the pose prompt, and only once", async () => {
    const livenessId = await stepUp();
    const { status, streamed } = await startFlash(livenessId);
    expect(status).toBe(200);
    const lines = streamed!.lines;
    expect(lines[0]).toMatchObject({ stepMs: 20 });
    expect((lines[0] as unknown as { colors: unknown[] }).colors).toHaveLength(STREAM_LEAD_STEPS);
    const steps = lines.filter((line): line is Extract<StreamLine, { step: number }> => "step" in line);
    const expectedSteps = Array.from({ length: 100 - STREAM_LEAD_STEPS }, (_, i) => i + STREAM_LEAD_STEPS);
    expect(steps.map((line) => line.step)).toEqual(expectedSteps);
    expect(streamed!.schedule.colors).toHaveLength(100);
    expect(streamed!.arc).not.toBeNull();
    expect(DIRECTIONS).toContain(streamed!.arc!.from);
    expect(DIRECTIONS).toContain(streamed!.arc!.to);
    expect(lines.at(-1)).toMatchObject({ end: true, windowMs: arcWindowMs(streamed!.arc!) });
    // The whole schedule is never in one line, and a second start gets nothing.
    expect(lines.every((line) => !("colors" in line) || line.colors.length <= STREAM_LEAD_STEPS)).toBe(true);
    expect((await startFlash(livenessId)).status).toBe(410);
  });
});

describe("the flash check", () => {
  test("a live face earns a liveness token, which verifies and charges the liveness price", async () => {
    const livenessId = await stepUp();
    const { streamed } = await startFlash(livenessId);
    const { flash, pose } = await run(livenessId, captureFor("genuine", streamed!));
    expect(await flash.json()).toEqual({ kind: "continue" });
    const outcome = (await pose.json()) as { kind: string; token: string };
    expect(outcome.kind).toBe("token");

    const before = (await app.query<{ balanceMicros: number }>("billing.summary", undefined, cookie)).balanceMicros;
    const verified = (await (
      await app.call("/v1/siteverify", { json: { secret: secretKey, response: outcome.token }, origin: null })
    ).json()) as { success: boolean; assurance: string };
    expect(verified).toMatchObject({ success: true, assurance: "liveness" });
    const after = (await app.query<{ balanceMicros: number }>("billing.summary", undefined, cookie)).balanceMicros;
    expect(before - after).toBe(20_000);
  });

  test("a head that doesn't follow the ring gets a pose hint, after the flash passed", async () => {
    geometry = {
      analyze: (capture) =>
        Promise.resolve({ ...skippedGeometry(capture), verdict: "retry" as const, reason: "pose-missed" as const }),
    };
    try {
      const livenessId = await stepUp();
      const { streamed } = await startFlash(livenessId);
      const { pose } = await run(livenessId, captureFor("genuine", streamed!));
      expect(await pose.json()).toMatchObject({ kind: "retry", reason: "pose-missed" });
    } finally {
      geometry = null;
    }
  });

  test("the flash answer is the same for a replay; the pose upload settles it, and only once", async () => {
    const livenessId = await stepUp();
    const { streamed } = await startFlash(livenessId);
    const { flash, pose } = await run(livenessId, captureFor("replay", streamed!));
    expect(await flash.json()).toEqual({ kind: "continue" });
    // Usually a fail; a replay that happens to look faint gets a capped retry with a fresh check.
    expect(["fail", "retry"]).toContain(((await pose.json()) as { kind: string }).kind);
    expect((await upload("pose", livenessId, poseBody(captureFor("replay", streamed!)))).status).toBe(410);
  });

  test("a pose upload needs a flash upload first, and a flash upload can't repeat", async () => {
    const livenessId = await stepUp();
    const { streamed } = await startFlash(livenessId);
    const capture = captureFor("genuine", streamed!);
    setSystemTime(new Date(Date.now() + SCHEDULE_MS + 500));
    expect((await upload("pose", livenessId, poseBody(capture))).status).toBe(410);
    expect((await upload("submit", livenessId, flashBody(capture))).status).toBe(200);
    expect((await upload("submit", livenessId, flashBody(capture))).status).toBe(410);
  });

  test("an upload before the schedule could have finished playing isn't confirmed", async () => {
    const livenessId = await stepUp();
    const { streamed } = await startFlash(livenessId);
    const capture = captureFor("genuine", streamed!);
    const flash = await upload("submit", livenessId, flashBody(capture));
    expect(await flash.json()).toEqual({ kind: "continue" });
    setSystemTime(new Date(Date.now() + SCHEDULE_MS + arcWindowMs(capture.pose.arc)));
    expect(await (await upload("pose", livenessId, poseBody(capture))).json()).toMatchObject({
      kind: "retry",
      reason: "unconfirmed",
    });
  });

  const clearRequestLimits = (): Promise<unknown> =>
    sqlFor(app.auth.options.database).all(`DELETE FROM "requestLimit"`, []);

  /** Uploads every capture too early, as a forger would, and collects each outcome until a fail. */
  const forgeUntilFail = async (): Promise<string[]> => {
    // Up to five checks from one address: start from fresh per-IP limits, whatever ran before.
    await clearRequestLimits();
    let livenessId = await stepUp();
    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 10 && outcomes.at(-1) !== "fail"; attempt++) {
      const { streamed } = await startFlash(livenessId);
      const capture = captureFor("genuine", streamed!);
      await upload("submit", livenessId, flashBody(capture));
      setSystemTime(new Date(Date.now() + SCHEDULE_MS + arcWindowMs(capture.pose.arc)));
      const outcome = (await (await upload("pose", livenessId, poseBody(capture))).json()) as {
        kind: string;
        reason?: string;
        livenessId?: string;
      };
      outcomes.push(outcome.reason ?? outcome.kind);
      livenessId = outcome.livenessId ?? livenessId;
    }
    return outcomes;
  };

  test("a check that isn't confirmed gets retries up to the configured attempts, then fails", async () => {
    try {
      expect(await forgeUntilFail()).toEqual(["unconfirmed", "unconfirmed", "fail"]);
      process.env.LIVENESS_MAX_ATTEMPTS = "5";
      expect(await forgeUntilFail()).toEqual(["unconfirmed", "unconfirmed", "unconfirmed", "unconfirmed", "fail"]);
    } finally {
      delete process.env.LIVENESS_MAX_ATTEMPTS;
      // Nor may these checks' limits carry over into the next tests.
      await clearRequestLimits();
    }
  });

  test("a stalled stream gets a retry, not a judgment", async () => {
    const livenessId = await stepUp();
    const { streamed } = await startFlash(livenessId);
    const capture = captureFor("genuine", streamed!);
    // Half the steps painted a second late.
    const paintTimes = capture.paintTimes.map((t, k) => (k >= 50 ? t + 1000 : t));
    const { pose } = await run(livenessId, capture, { flash: flashBody(capture, { paintTimes }) });
    expect(await pose.json()).toMatchObject({ kind: "retry", reason: "network" });
  });

  test("bad conditions get a few retries with a hint, then fail", async () => {
    let livenessId = await stepUp();
    const reasons: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const { streamed } = await startFlash(livenessId);
      const capture = captureFor("genuine", streamed!);
      // No key frames and a dark, far face: the flash stage can't measure enough.
      const dim = { ...capture, pixels: capture.pixels.map((v) => Math.round(v * 0.12)) };
      const { pose } = await run(livenessId, dim, { flash: flashBody(dim), pose: poseBody(capture) });
      const outcome = (await pose.json()) as { kind: string; reason?: string; livenessId?: string };
      reasons.push(outcome.reason ?? outcome.kind);
      livenessId = outcome.livenessId ?? livenessId;
    }
    expect(reasons.slice(0, 2).every((reason) => ["too-dark", "too-faint"].includes(reason))).toBe(true);
    expect(reasons[2]).toBe("fail");
  });

  test("malformed uploads are 400s, and no frame data or colors reach the logs", async () => {
    const logged: unknown[] = [];
    const spies = (["info", "warn", "error"] as const).map((level) =>
      spyOn(console, level).mockImplementation((...args: unknown[]) => logged.push(...args)),
    );
    try {
      const livenessId = await stepUp();
      const { streamed } = await startFlash(livenessId);
      const capture = captureFor("genuine", streamed!);
      setSystemTime(new Date(Date.now() + SCHEDULE_MS + 500));
      expect((await upload("submit", livenessId, Bun.gzipSync(new Uint8Array(500)))).status).toBe(400);
      const next = await stepUp();
      const started = await startFlash(next);
      const good = captureFor("genuine", started.streamed!);
      setSystemTime(new Date(Date.now() + SCHEDULE_MS + 500));
      expect((await upload("submit", next, flashBody(good))).status).toBe(200);
      expect((await upload("pose", next, Bun.gzipSync(new Uint8Array(500)))).status).toBe(400);
      void capture;
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
    const text = JSON.stringify(logged);
    expect(text).not.toMatch(/(\d{1,3},){50}/);
    expect(text).not.toMatch(/"colors"/);
    expect(text.length).toBeLessThan(20_000);
  });

  test("the source report is validated strictly", async () => {
    const livenessId = await stepUp();
    const { streamed } = await startFlash(livenessId);
    const capture = captureFor("genuine", streamed!);
    setSystemTime(new Date(Date.now() + SCHEDULE_MS + 500));
    const extra = flashBody(capture, { source: { label: "x".repeat(65) } });
    expect((await upload("submit", livenessId, extra)).status).toBe(400);
  });

  test("only scalar scores are stored, and a settled check isn't pending", async () => {
    const rows = await sqlFor(app.auth.options.database).all<Record<string, unknown>>(
      `SELECT * FROM "livenessStat"`,
      [],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.decision === "pass")).toBe(true);
    for (const row of rows) {
      expect(
        Object.values(row).every(
          (value) =>
            value === null || ["string", "number", "boolean", "bigint"].includes(typeof value) || value instanceof Date,
        ),
      ).toBe(true);
      expect(
        JSON.stringify(row, (_, value: unknown) => (typeof value === "bigint" ? Number(value) : value)).length,
      ).toBeLessThan(900);
    }
  });
});
