import type { BetterAuthPlugin } from "better-auth";

/**
 * BotRepel's tables, as one Better Auth plugin schema so `auth.migrate()` creates and alters them
 * with the auth tables on SQLite and Postgres alike. JSON values are stored as text so raw SQL
 * reads them the same way on both. Money is integer micro-dollars.
 */
export const appSchema = {
  id: "botrepel-app",
  schema: {
    site: {
      fields: {
        ownerId: {
          type: "string",
          required: true,
          index: true,
          references: { model: "user", field: "id", onDelete: "cascade" },
        },
        name: { type: "string", required: true },
        siteKey: { type: "string", required: true, unique: true },
        secretHash: { type: "string", required: true, unique: true },
        /** The first characters of the secret, so the dashboard can show which key is current. */
        secretPrefix: { type: "string", required: true },
        /** After a rotation the old secret keeps working until `previousSecretExpiresAt`. */
        previousSecretHash: { type: "string", required: false, index: true },
        previousSecretExpiresAt: { type: "date", required: false },
        /** JSON array of hostnames allowed to embed the widget. */
        domains: { type: "string", required: true },
        /** JSON object: action (or "*") to the minimum assurance. */
        policies: { type: "string", required: true },
        /** "degrade" serves the invisible tier when credit runs out; "fail_closed" refuses. */
        onUnpaid: { type: "string", required: true, defaultValue: "degrade" },
        createdAt: { type: "date", required: true },
      },
    },
    challenge: {
      fields: {
        siteId: {
          type: "string",
          required: true,
          index: true,
          references: { model: "site", field: "id", onDelete: "cascade" },
        },
        action: { type: "string", required: true },
        hostname: { type: "string", required: true },
        kind: { type: "string", required: true },
        /** JSON: what only the server knows about this challenge (the puzzle seed, later the flash schedule). */
        secret: { type: "string", required: true },
        /** The strongest assurance this challenge must reach, after policy, risk, and credit. */
        required: { type: "string", required: true },
        /** Risk in thousandths (0–1000); see `toRiskMilli`. */
        riskMilli: { type: "number", required: true },
        unpaid: { type: "boolean", required: true, defaultValue: false },
        expiresAt: { type: "date", required: true, index: true },
        /** When the flash schedule was handed out, for liveness challenges. */
        startedAt: { type: "date", required: false },
        /** When the flash upload was claimed; the pose upload needs it. */
        flashAt: { type: "date", required: false },
        usedAt: { type: "date", required: false },
        createdAt: { type: "date", required: true },
      },
    },
    /** Scalar scores from each flash check, for tuning thresholds. Nothing biometric, nothing per person. */
    livenessStat: {
      fields: {
        day: { type: "string", required: true, index: true },
        decision: { type: "string", required: true },
        reason: { type: "string", required: false },
        /** Scores in ten-thousandths, since numbers are integers on Postgres. */
        correlationE4: { type: "number", required: true },
        /** Optional only because rows from before it was measured in ms have none. */
        lagMs: { type: "number", required: false },
        gainSpreadE4: { type: "number", required: true },
        depthE4: { type: "number", required: true },
        brightness: { type: "number", required: true },
        frames: { type: "number", required: true },
        whiteBalanceLocked: { type: "boolean", required: true },
        exposureLocked: { type: "boolean", required: true },
        // Protocol 2 scalars, optional because older rows have none. "pending" rows got a flash
        // upload but no pose upload. Never anything biometric: no frames, crops, or landmarks.
        dipCorrelationE4: { type: "number", required: false },
        specularMeasured: { type: "boolean", required: false },
        specularE4: { type: "number", required: false },
        stallMs: { type: "number", required: false },
        motionE4: { type: "number", required: false },
        skinRgE4: { type: "number", required: false },
        skinBgE4: { type: "number", required: false },
        keyFrames: { type: "number", required: false },
        injectionE4: { type: "number", required: false },
        riskE4: { type: "number", required: false },
        padLiveE4: { type: "number", required: false },
        poseHit: { type: "boolean", required: false },
        poseMs: { type: "number", required: false },
        yawPeakDeg: { type: "number", required: false },
        judgeLiveE4: { type: "number", required: false },
        judgeMs: { type: "number", required: false },
        continuityE4: { type: "number", required: false },
        poseFrames: { type: "number", required: false },
        analysisMs: { type: "number", required: false },
        completedAt: { type: "date", required: false },
      },
    },
    /** A CLI's credential: usable only on /v1/cli/*, so a leaked token can't touch billing or delete sites. */
    cliToken: {
      fields: {
        userId: {
          type: "string",
          required: true,
          index: true,
          references: { model: "user", field: "id", onDelete: "cascade" },
        },
        tokenHash: { type: "string", required: true, unique: true },
        /** The first characters, to tell tokens apart in Settings. */
        prefix: { type: "string", required: true },
        createdAt: { type: "date", required: true },
        lastUsedAt: { type: "date", required: false },
      },
    },
    /**
     * A BotRepel-wide passkey, created once after a strict flash check. It identifies no one: the
     * user handle is random, and sites only ever see a per-site pseudonym.
     */
    humanPass: {
      fields: {
        credentialId: { type: "string", required: true, unique: true },
        publicKey: { type: "string", required: true },
        /** WebAuthn counters are unsigned 32-bit, past int4's range. */
        counter: { type: "number", required: true, bigint: true },
        aaguid: { type: "string", required: true },
        backedUp: { type: "boolean", required: true },
        /** active | burned */
        status: { type: "string", required: true, defaultValue: "active" },
        /** Assertions in the current hour, for the per-pass quota. */
        hour: { type: "number", required: true, bigint: true },
        hourCount: { type: "number", required: true },
        createdAt: { type: "date", required: true },
      },
    },
    /** Sites reporting a pass for abuse; several established sites burn it. */
    humanPassReport: {
      fields: {
        passId: {
          type: "string",
          required: true,
          index: true,
          references: { model: "humanPass", field: "id", onDelete: "cascade" },
        },
        siteId: { type: "string", required: true, references: { model: "site", field: "id", onDelete: "cascade" } },
        reason: { type: "string", required: true },
        createdAt: { type: "date", required: true },
      },
    },
    verificationToken: {
      fields: {
        /** sha256 of the token; the token itself is never stored. */
        tokenHash: { type: "string", required: true, unique: true },
        siteId: {
          type: "string",
          required: true,
          index: true,
          references: { model: "site", field: "id", onDelete: "cascade" },
        },
        action: { type: "string", required: true },
        hostname: { type: "string", required: true },
        assurance: { type: "string", required: true },
        riskMilli: { type: "number", required: true },
        unpaid: { type: "boolean", required: true, defaultValue: false },
        pseudonym: { type: "string", required: false },
        /** Internal only, for abuse reports; never returned to sites. */
        passId: { type: "string", required: false, index: true },
        createdAt: { type: "date", required: true },
        expiresAt: { type: "date", required: true, index: true },
        redeemedAt: { type: "date", required: false },
      },
    },
    balance: {
      fields: {
        userId: {
          type: "string",
          required: true,
          unique: true,
          references: { model: "user", field: "id", onDelete: "cascade" },
        },
        micros: { type: "number", required: true, bigint: true },
        /** Set when the low-credit and out-of-credit emails go out; cleared by a top-up. */
        lowNotifiedAt: { type: "date", required: false },
        emptyNotifiedAt: { type: "date", required: false },
      },
    },
    ledgerEntry: {
      fields: {
        userId: {
          type: "string",
          required: true,
          index: true,
          references: { model: "user", field: "id", onDelete: "cascade" },
        },
        siteId: { type: "string", required: false, index: true },
        /** grant | usage | topup | adjust */
        kind: { type: "string", required: true },
        /** For usage: the assurance charged. */
        tier: { type: "string", required: false },
        quantity: { type: "number", required: true, bigint: true },
        /** Signed: grants and top-ups are positive, usage negative. */
        amountMicros: { type: "number", required: true, bigint: true },
        /** Hours since the epoch; usage rows aggregate per site, tier, and hour. */
        hour: { type: "number", required: true, index: true, bigint: true },
        idempotencyKey: { type: "string", required: true, unique: true },
        createdAt: { type: "date", required: true },
      },
    },
  },
} satisfies BetterAuthPlugin;
