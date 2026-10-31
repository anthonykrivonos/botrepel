import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { memberProcedure, router } from "./core";
import { TOP_UP_DOLLARS } from "../../src/shared/pricing";
import { balanceOf, hourOf, usageSince } from "../ledger";

const USAGE_DAYS = 30;

export const billingRouter = router({
  /** Credit left, in micro-dollars, and usage over the last 30 days by site and tier. */
  summary: memberProcedure.query(async ({ ctx }) => {
    const balance = await balanceOf(ctx.adapter, ctx.caller.userId);
    const usage = await usageSince(ctx.sql, ctx.caller.userId, hourOf(Date.now()) - USAGE_DAYS * 24);
    return { balanceMicros: Number(balance?.micros ?? 0), usage, canTopUp: ctx.payments !== null };
  }),
  /** A Stripe Checkout page for adding credit; the webhook credits the account once it's paid. */
  checkout: memberProcedure
    .input(z.object({ dollars: z.union(TOP_UP_DOLLARS.map((amount) => z.literal(amount))) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.payments) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Payments aren't set up on this server yet." });
      }
      const user = await ctx.adapter.findOne<{ email: string }>({
        model: "user",
        where: [{ field: "id", value: ctx.caller.userId }],
      });
      return ctx.payments.createCheckout({
        userId: ctx.caller.userId,
        email: user!.email,
        dollars: input.dollars,
        origin: ctx.origin,
      });
    }),
});
