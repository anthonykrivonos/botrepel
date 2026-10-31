import type { DBAdapter } from "better-auth";
import type { FlashScores, InjectionScores, LivenessAnalyzer, PoseAnalysis, StageResult } from "./analyzer";
import { pickArc } from "./arc";
import { CaptureError, decodeFlashCapture, decodePoseCapture } from "./decode";
import { borderline, fuse, strictPass, type LivenessVerdict, type StageResults } from "./fusion";
import { injectionScore } from "./injection";
import { ModelsBusyError } from "./models/runtime";
import { cryptoRandom, type Random } from "./random";
import { newSchedule } from "./schedule";
import {
  FULL_TURN_WINDOW_MS,
  SCHEDULE_MS,
  type Arc,
  type LivenessRetry,
  type Schedule,
} from "../../src/shared/liveness";
import { fail, succeed, type DomainResult } from "../../src/shared/result";
import type { Sql } from "../db";
import { readEnv } from "../env";
import { serializeError } from "../errors";
import { offerChallenge } from "../human-pass";
import { Logger } from "../logger";
import { asBoolean, asDate, fromRiskMilli, toRiskMilli, type ChallengeInsert, type ChallengeRecord } from "../records";
import { mintToken } from "../tokens";

/** A person has this long after a step-up to read the notice and start. */
export const LIVENESS_OFFER_MS = 5 * 60_000;
/** After the stream starts: the schedule, the longest pose window, camera start-up, and two uploads. */
export const LIVENESS_RUN_MS = SCHEDULE_MS + FULL_TURN_WINDOW_MS + 25_000;
/** A pose upload has to arrive this soon after the prompt left the server. */
export const POSE_RUN_MS = FULL_TURN_WINDOW_MS + 8_000;
/**
 * Attempts per check, unless `LIVENESS_MAX_ATTEMPTS` sets another number. Bad conditions (dim
 * screen, movement, a stalled stream) and a check that couldn't confirm a live person both earn a
 * fresh attempt until then: a real person who moved at the wrong moment shouldn't be locked out.
 * A forger gets no more than this, on top of the per-IP liveness limits.
 */
export const MAX_ATTEMPTS = 3;
const maxAttempts = (): number => Math.max(1, readEnv().LIVENESS_MAX_ATTEMPTS ?? MAX_ATTEMPTS);

const logger = new Logger("liveness");

interface FlashRecord {
  readonly result: StageResult<FlashScores>;
  readonly injection: InjectionScores;
  readonly frames: number;
  readonly keyFrames: number;
  readonly whiteBalanceLocked: boolean;
  readonly exposureLocked: boolean;
}

interface LivenessSecret {
  readonly attempt: number;
  readonly schedule?: Schedule;
  /** Issued by the stream once the colors are done; what the pose upload is judged against. */
  readonly pose?: { readonly arc: Arc; readonly issuedAt: number };
  /** The flash upload's verdict, kept for the pose upload to fuse with. */
  readonly flash?: FlashRecord;
  readonly statId?: string;
}

/** Offers a flash check after the invisible tier asked for more. */
export async function offerLiveness(
  adapter: DBAdapter,
  base: Pick<ChallengeRecord, "siteId" | "action" | "hostname" | "required" | "risk">,
  attempt: number,
  now = Date.now(),
): Promise<string> {
  const challenge = await adapter.create<ChallengeInsert, { id: string }>({
    model: "challenge",
    data: {
      siteId: base.siteId,
      action: base.action,
      hostname: base.hostname,
      required: base.required,
      riskMilli: toRiskMilli(base.risk),
      kind: "liveness",
      secret: JSON.stringify({ attempt } satisfies LivenessSecret),
      unpaid: false,
      expiresAt: new Date(now + LIVENESS_OFFER_MS),
      startedAt: null,
      flashAt: null,
      usedAt: null,
      createdAt: new Date(now),
    },
  });
  return challenge.id;
}

const rowToChallenge = (row: Record<string, unknown>): ChallengeRecord => ({
  ...(row as unknown as ChallengeRecord),
  risk: fromRiskMilli(row),
  unpaid: asBoolean(row.unpaid),
  expiresAt: asDate(row.expiresAt)!,
  startedAt: asDate(row.startedAt),
  flashAt: asDate(row.flashAt),
  createdAt: asDate(row.createdAt)!,
  usedAt: asDate(row.usedAt),
});

/**
 * Makes the one-time schedule, once: a second start, or a start after the offer expired, gets
 * nothing. The run deadline starts now. The caller streams the schedule; it never leaves whole.
 */
export async function startLiveness(sql: Sql, livenessId: string, now = Date.now()): Promise<DomainResult<Schedule>> {
  const [row] = await sql.all<Record<string, unknown>>(
    `SELECT * FROM "challenge" WHERE "id" = ? AND "kind" = 'liveness' AND "usedAt" IS NULL AND "startedAt" IS NULL AND "expiresAt" > ?`,
    [livenessId, new Date(now).toISOString()],
  );
  if (!row) {
    return fail(410, "This check expired. Start again.");
  }
  const secret = JSON.parse(String(row.secret)) as LivenessSecret;
  const schedule = newSchedule();
  const claimed = await sql.all(
    `UPDATE "challenge" SET "secret" = ?, "startedAt" = ?, "expiresAt" = ?
     WHERE "id" = ? AND "startedAt" IS NULL RETURNING "id"`,
    [
      JSON.stringify({ ...secret, schedule } satisfies LivenessSecret),
      new Date(now).toISOString(),
      new Date(now + LIVENESS_RUN_MS).toISOString(),
      livenessId,
    ],
  );
  return claimed.length ? succeed(schedule) : fail(410, "This check already started.");
}

/**
 * Picks the arc to ask for, once per check, after the colors are done. Idempotent: a second call
 * returns the same arc.
 */
export async function issueArc(
  sql: Sql,
  livenessId: string,
  now = Date.now(),
  random: Random = cryptoRandom,
): Promise<DomainResult<{ readonly arc: Arc }>> {
  const [row] = await sql.all<{ secret: string }>(
    `SELECT "secret" FROM "challenge" WHERE "id" = ? AND "kind" = 'liveness' AND "startedAt" IS NOT NULL AND "usedAt" IS NULL AND "expiresAt" > ?`,
    [livenessId, new Date(now).toISOString()],
  );
  if (!row) {
    return fail(410, "This check expired. Start again.");
  }
  const secret = JSON.parse(row.secret) as LivenessSecret;
  if (secret.pose) {
    return succeed({ arc: secret.pose.arc });
  }
  const arc = pickArc(random);
  const claimed = await sql.all(`UPDATE "challenge" SET "secret" = ? WHERE "id" = ? AND "secret" = ? RETURNING "id"`, [
    JSON.stringify({ ...secret, pose: { arc, issuedAt: now } } satisfies LivenessSecret),
    livenessId,
    row.secret,
  ]);
  return claimed.length ? succeed({ arc }) : issueArc(sql, livenessId, now, random);
}

export interface FlashOutcome {
  readonly kind: "continue";
}

export type LivenessOutcome =
  /** `anchorId` lets this person create a Human Pass, after an especially clear pass. */
  | { readonly kind: "token"; readonly token: string; readonly assurance: "liveness"; readonly anchorId?: string }
  | { readonly kind: "retry"; readonly reason: LivenessRetry; readonly livenessId: string }
  | { readonly kind: "fail" };

/**
 * Judges the flash upload against what was streamed and keeps the verdict for the pose upload. The
 * answer is the same whatever the verdict, so the flash alone gives nothing away. The frames are
 * analyzed in memory and zeroed afterwards; only scalar scores are kept.
 */
export async function submitFlash(
  adapter: DBAdapter,
  sql: Sql,
  analyzer: LivenessAnalyzer,
  input: { livenessId: string; body: Uint8Array },
  now = Date.now(),
): Promise<DomainResult<FlashOutcome>> {
  const [row] = await sql.all<Record<string, unknown>>(
    `UPDATE "challenge" SET "flashAt" = ?
     WHERE "id" = ? AND "kind" = 'liveness' AND "usedAt" IS NULL AND "flashAt" IS NULL AND "startedAt" IS NOT NULL AND "expiresAt" > ?
     RETURNING *`,
    [new Date(now).toISOString(), input.livenessId, new Date(now).toISOString()],
  );
  if (!row) {
    return fail(410, "This check expired. Start again.");
  }
  const challenge = rowToChallenge(row);
  const secret = JSON.parse(challenge.secret) as LivenessSecret;
  if (!secret.schedule) {
    return fail(410, "This check expired. Start again.");
  }
  let capture;
  try {
    capture = decodeFlashCapture(input.body);
  } catch (error) {
    if (error instanceof CaptureError) {
      return fail(400, error.message);
    }
    throw error;
  }
  let result: StageResult<FlashScores>;
  let injection: InjectionScores;
  try {
    // Nothing can be captured before the schedule has finished playing.
    const early = now - challenge.startedAt!.getTime() < SCHEDULE_MS;
    result = early
      ? {
          verdict: "fail",
          scores: (await analyzer.flash(capture, { schedule: secret.schedule, paintTimes: [] })).scores,
        }
      : await analyzer.flash(capture, { schedule: secret.schedule, paintTimes: capture.paintTimes });
    injection = injectionScore(capture.source, capture);
  } finally {
    capture.pixels.fill(0);
    capture.keyPixels.fill(0);
    input.body.fill(0);
  }
  const flash: FlashRecord = {
    result,
    injection,
    frames: capture.frameCount,
    keyFrames: capture.keyFrameCount,
    whiteBalanceLocked: capture.whiteBalanceLocked,
    exposureLocked: capture.exposureLocked,
  };
  const statId = await recordFlashStat(adapter, flash, now);
  await sql.all(`UPDATE "challenge" SET "secret" = ? WHERE "id" = ?`, [
    JSON.stringify({ ...secret, flash, ...(statId ? { statId } : {}) } satisfies LivenessSecret),
    input.livenessId,
  ]);
  return succeed({ kind: "continue" });
}

/**
 * Judges the pose upload, fuses it with the flash verdict, and settles the check: a token, a retry
 * with a fresh check, or a fail. Model stages still run on a failed flash, so the answer's timing
 * doesn't say which gate failed.
 */
export async function submitPose(
  adapter: DBAdapter,
  sql: Sql,
  analyzer: LivenessAnalyzer,
  input: { livenessId: string; body: Uint8Array },
  now = Date.now(),
): Promise<DomainResult<LivenessOutcome>> {
  const [row] = await sql.all<Record<string, unknown>>(
    `UPDATE "challenge" SET "usedAt" = ?
     WHERE "id" = ? AND "kind" = 'liveness' AND "usedAt" IS NULL AND "flashAt" IS NOT NULL AND "expiresAt" > ?
     RETURNING *`,
    [new Date(now).toISOString(), input.livenessId, new Date(now).toISOString()],
  );
  if (!row) {
    return fail(410, "This check expired. Start again.");
  }
  const challenge = rowToChallenge(row);
  const secret = JSON.parse(challenge.secret) as LivenessSecret;
  const retryOrFail = async (reason: LivenessRetry): Promise<DomainResult<LivenessOutcome>> =>
    secret.attempt < maxAttempts()
      ? succeed({ kind: "retry", reason, livenessId: await offerLiveness(adapter, challenge, secret.attempt + 1, now) })
      : succeed({ kind: "fail" });
  if (!secret.flash) {
    return succeed({ kind: "fail" });
  }
  if (!secret.pose) {
    // The stream never issued a prompt (it broke, or the database did).
    await completeStat(adapter, secret.statId, { kind: "retry", reason: "network" }, null, now);
    return retryOrFail("network");
  }
  if (now - secret.pose.issuedAt > POSE_RUN_MS) {
    await completeStat(adapter, secret.statId, { kind: "retry", reason: "network" }, null, now);
    return retryOrFail("network");
  }
  let capture;
  try {
    capture = decodePoseCapture(input.body);
  } catch (error) {
    if (error instanceof CaptureError) {
      return fail(400, error.message);
    }
    throw error;
  }
  const started = performance.now();
  let verdict: LivenessVerdict;
  let stages: StageResults;
  try {
    let analysis: PoseAnalysis;
    try {
      analysis = await analyzer.pose(capture, secret.pose.arc);
    } catch (error) {
      if (error instanceof ModelsBusyError) {
        // Too many analyses at once on this instance: a fresh attempt rather than a judgment.
        await completeStat(adapter, secret.statId, { kind: "retry", reason: "network" }, null, now);
        return retryOrFail("network");
      }
      throw error;
    }
    const poseInjection = injectionScore(capture.source, capture, { timing: false });
    stages = {
      flash: secret.flash.result,
      injection: poseInjection.score > secret.flash.injection.score ? poseInjection : secret.flash.injection,
      geometry: analysis.geometry,
      pad: analysis.pad,
      judge: null,
      continuity: null,
    };
    verdict = fuse(stages);
    if (analyzer.judge && borderline(stages, verdict)) {
      const judge = await analyzer.judge.judge(analysis.frames, { siteId: challenge.siteId });
      stages = { ...stages, judge };
      verdict = fuse(stages);
    }
  } finally {
    capture.pixels.fill(0);
    input.body.fill(0);
  }
  await completeStat(
    adapter,
    secret.statId,
    verdict.kind === "retry" ? { kind: "retry", reason: verdict.reason } : { kind: verdict.kind },
    { verdict, poseFrames: capture.frameCount, analysisMs: Math.round(performance.now() - started) },
    now,
  );

  if (verdict.kind === "pass") {
    const token = await mintToken(
      adapter,
      {
        siteId: challenge.siteId,
        action: challenge.action,
        hostname: challenge.hostname,
        assurance: "liveness",
        risk: challenge.risk,
        unpaid: false,
      },
      now,
    );
    const anchorId = strictPass(stages, verdict)
      ? await offerChallenge(adapter, challenge, "pass-anchor", now)
      : undefined;
    return succeed({ kind: "token", token, assurance: "liveness", ...(anchorId ? { anchorId } : {}) });
  }
  return retryOrFail(verdict.kind === "retry" ? verdict.reason : "unconfirmed");
}

const e4 = (value: number): number => Math.round(value * 10_000);

/** The flash upload's scalars, as a row the pose upload will complete; null when the write failed. */
async function recordFlashStat(adapter: DBAdapter, flash: FlashRecord, now: number): Promise<string | null> {
  const { scores } = flash.result;
  try {
    const row = await adapter.create<Record<string, unknown>, { id: string }>({
      model: "livenessStat",
      data: {
        day: new Date(now).toISOString().slice(0, 10),
        decision: "pending",
        reason: null,
        correlationE4: e4(scores.correlation),
        lagMs: scores.lagMs,
        gainSpreadE4: e4(scores.gainSpread),
        depthE4: e4(scores.depth),
        brightness: scores.brightness,
        frames: flash.frames,
        whiteBalanceLocked: flash.whiteBalanceLocked,
        exposureLocked: flash.exposureLocked,
        dipCorrelationE4: e4(scores.dipCorrelation),
        specularMeasured: scores.specular.measured,
        specularE4: scores.specular.measured ? e4(scores.specular.gain) : null,
        stallMs: scores.stallMs,
        motionE4: e4(scores.motion),
        skinRgE4: e4(scores.skin.rg),
        skinBgE4: e4(scores.skin.bg),
        keyFrames: flash.keyFrames,
        injectionE4: e4(flash.injection.score),
      },
    });
    return row.id;
  } catch (error) {
    logger.warn("Could not record liveness scores", { cause: serializeError(error) });
    return null;
  }
}

/** Settles the row with the pose upload's scalars and the decision. Never affects the decision. */
async function completeStat(
  adapter: DBAdapter,
  statId: string | undefined,
  decision: { kind: "pass" | "fail" | "retry"; reason?: LivenessRetry },
  pose: { verdict: LivenessVerdict; poseFrames: number; analysisMs: number } | null,
  now: number,
): Promise<void> {
  if (!statId) {
    return;
  }
  const scores = pose?.verdict.scores;
  try {
    await adapter.update({
      model: "livenessStat",
      where: [{ field: "id", value: statId }],
      update: {
        decision: decision.kind,
        reason: decision.reason ?? null,
        ...(scores
          ? {
              injectionE4: e4(scores.injection.score),
              riskE4: e4(scores.risk),
              padLiveE4: scores.pad ? e4(scores.pad.live) : null,
              poseHit: scores.geometry ? scores.geometry.hit : null,
              poseMs: scores.geometry ? scores.geometry.poseMs : null,
              yawPeakDeg: scores.geometry ? Math.round(scores.geometry.yawPeakDeg) : null,
              judgeLiveE4:
                scores.judge?.live !== null && scores.judge?.live !== undefined ? e4(scores.judge.live) : null,
              judgeMs: scores.judge?.ran ? scores.judge.ms : null,
              continuityE4: scores.continuity === null ? null : e4(scores.continuity),
              poseFrames: pose.poseFrames,
              analysisMs: pose.analysisMs,
              completedAt: new Date(now),
            }
          : {}),
      },
    });
  } catch (error) {
    logger.warn("Could not complete liveness scores", { cause: serializeError(error) });
  }
}
