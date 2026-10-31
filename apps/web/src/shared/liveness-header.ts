/** Server-side validation of the capture headers (src/shared/liveness.ts holds the widget-safe types). */
import { z } from "zod";
import {
  MAX_FRAMES,
  MAX_KEY_FRAMES,
  MAX_POSE_FRAMES,
  MIN_FRAMES,
  MIN_POSE_FRAMES,
  PROTOCOL_VERSION,
  SCHEDULE_STEPS,
} from "./liveness";

const ms = z.number().min(-1000).max(60_000);

export const SourceSignalsSchema = z
  .object({
    label: z.string().max(64).optional(),
    deviceId: z.boolean().optional(),
    capabilities: z.number().int().min(0).max(64).optional(),
    rvfc: z.boolean().optional(),
    captureTime: z.boolean().optional(),
    captureLagMs: z.number().min(-1000).max(10_000).nullable().optional(),
    width: z.number().int().positive().max(8192).optional(),
    height: z.number().int().positive().max(8192).optional(),
    frameRate: z.number().positive().max(240).optional(),
    displaySurface: z.boolean().optional(),
    hiddenMs: z.number().min(0).max(600_000).optional(),
  })
  .strict();

export const FlashHeaderSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    times: z.array(ms).min(MIN_FRAMES).max(MAX_FRAMES),
    keyTimes: z.array(ms).max(MAX_KEY_FRAMES),
    paintTimes: z.array(ms).max(SCHEDULE_STEPS),
    whiteBalanceLocked: z.boolean(),
    exposureLocked: z.boolean(),
    source: SourceSignalsSchema.default({}),
  })
  .strict();

export const PoseHeaderSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    times: z.array(ms).min(MIN_POSE_FRAMES).max(MAX_POSE_FRAMES),
    source: SourceSignalsSchema.default({}),
  })
  .strict();
