import { accountRouter } from "./account";
import { adminRouter } from "./admin";
import { billingRouter } from "./billing";
import { publicProcedure, router } from "./core";
import { sitesRouter } from "./sites";

export const appRouter = router({
  sites: sitesRouter,
  account: accountRouter,
  billing: billingRouter,
  admin: adminRouter,
  /** Which sign-in buttons the login page shows. */
  signInMethods: publicProcedure.query(({ ctx }) => ctx.loginMethods),
  /** The signed-in account, or null; the dashboard decides between sign-in and the app from it. */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.caller) {
      return null;
    }
    const user = await ctx.adapter.findOne<{ id: string; email: string; name: string; image: string | null }>({
      model: "user",
      where: [{ field: "id", value: ctx.caller.userId }],
    });
    return user ? { id: user.id, email: user.email, name: user.name, image: user.image } : null;
  }),
});

export type AppRouter = typeof appRouter;
