import { z } from "zod";
import { memberProcedure, router } from "./core";
import { listCliTokens, revokeCliToken } from "../cli-tokens";
import { listSites } from "../sites";

export const accountRouter = router({
  /** Everything stored about the account, minus secrets: the GDPR export. */
  export: memberProcedure.query(async ({ ctx }) => {
    const user = await ctx.adapter.findOne<{ email: string; name: string; createdAt: Date }>({
      model: "user",
      where: [{ field: "id", value: ctx.caller.userId }],
    });
    const ledger = await ctx.sql.all<Record<string, unknown>>(
      `SELECT "kind", "tier", "siteId", "quantity", "amountMicros", "hour", "createdAt" FROM "ledgerEntry"
       WHERE "userId" = ? ORDER BY "createdAt" ASC LIMIT 100000`,
      [ctx.caller.userId],
    );
    return {
      exportedAt: new Date().toISOString(),
      account: user ? { email: user.email, name: user.name, createdAt: new Date(user.createdAt).toISOString() } : null,
      sites: await listSites(ctx.adapter, ctx.caller.userId),
      ledger: ledger.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
        amountMicros: Number(row.amountMicros),
        hour: Number(row.hour),
      })),
      cliTokens: await listCliTokens(ctx.adapter, ctx.caller.userId),
    };
  }),
  cliTokens: memberProcedure.query(({ ctx }) => listCliTokens(ctx.adapter, ctx.caller.userId)),
  revokeCliToken: memberProcedure
    .input(z.object({ id: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => ({ revoked: await revokeCliToken(ctx.sql, ctx.caller.userId, input.id) })),
});
