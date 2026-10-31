import { z } from "zod";
import { memberProcedure, router, unwrap } from "./core";
import { CreateSiteSchema, UpdateSiteSchema } from "../../src/shared/site";
import { createSite, deleteSite, listSites, rotateSecret, updateSite } from "../sites";

const SiteIdSchema = z.object({ siteId: z.string().min(1) });

export const sitesRouter = router({
  list: memberProcedure.query(({ ctx }) => listSites(ctx.adapter, ctx.caller.userId)),
  /** Returns the secret key this once. */
  create: memberProcedure
    .input(CreateSiteSchema)
    .mutation(async ({ ctx, input }) => unwrap(await createSite(ctx.adapter, ctx.caller.userId, input))),
  update: memberProcedure
    .input(UpdateSiteSchema)
    .mutation(async ({ ctx, input }) => unwrap(await updateSite(ctx.adapter, ctx.caller.userId, input))),
  /** The old secret keeps working for 24 hours. */
  rotateSecret: memberProcedure
    .input(SiteIdSchema)
    .mutation(async ({ ctx, input }) => unwrap(await rotateSecret(ctx.adapter, ctx.caller.userId, input.siteId))),
  delete: memberProcedure
    .input(SiteIdSchema)
    .mutation(async ({ ctx, input }) => unwrap(await deleteSite(ctx.adapter, ctx.caller.userId, input.siteId))),
});
