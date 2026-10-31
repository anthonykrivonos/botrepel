import { z } from "zod";
import { adminProcedure, router } from "./core";
import { livenessCalibration } from "../liveness/calibration";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const adminRouter = router({
  /** Liveness score distributions over the last `days`, for calibrating the light check. */
  liveness: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(180) }))
    .query(({ ctx, input }) =>
      livenessCalibration(ctx.sql, new Date(Date.now() - input.days * MS_PER_DAY).toISOString().slice(0, 10)),
    ),
});
