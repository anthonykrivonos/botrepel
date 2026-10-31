import type { DBAdapter } from "better-auth";
import type { Sql } from "./db";
import type { SendEmail } from "./email";
import { serializeError } from "./errors";
import { Logger } from "./logger";
import { FREE_CREDIT_MICROS, formatDollars } from "../src/shared/pricing";

/** The low-credit email goes out once the balance falls to a fifth of the free credit. */
export const LOW_BALANCE_MICROS = FREE_CREDIT_MICROS / 5;

const logger = new Logger("billing");

/** Claims a notice atomically, so concurrent charges send it once per episode. */
async function claim(
  sql: Sql,
  userId: string,
  column: "lowNotifiedAt" | "emptyNotifiedAt",
  now: number,
): Promise<boolean> {
  const rows = await sql.all(
    `UPDATE "balance" SET "${column}" = ? WHERE "userId" = ? AND "${column}" IS NULL RETURNING "id"`,
    [new Date(now).toISOString(), userId],
  );
  return rows.length > 0;
}

/** After a charge: tell the owner when credit runs low, and when it runs out. Never fails the charge. */
export async function notifyBalance(
  adapter: DBAdapter,
  sql: Sql,
  sendEmail: SendEmail | null,
  input: { userId: string; balanceMicros: number; origin: string },
  now = Date.now(),
): Promise<void> {
  if (!sendEmail || input.balanceMicros > LOW_BALANCE_MICROS) {
    return;
  }
  try {
    const empty = input.balanceMicros <= 0;
    if (!(await claim(sql, input.userId, empty ? "emptyNotifiedAt" : "lowNotifiedAt", now))) {
      return;
    }
    const user = await adapter.findOne<{ email: string }>({
      model: "user",
      where: [{ field: "id", value: input.userId }],
    });
    if (!user) {
      return;
    }
    await sendEmail({
      to: user.email,
      subject: empty ? "Your BotRepel credit ran out" : "Your BotRepel credit is running low",
      paragraphs: empty
        ? [
            "Your sites now serve only the invisible check, and verifications report unpaid: true. Sites set to fail closed refuse new checks.",
            "Add credit to restore Human Pass and liveness checks.",
          ]
        : [`You have ${formatDollars(Math.max(0, input.balanceMicros))} of credit left.`],
      action: { label: "Add Credit", url: `${input.origin}/dashboard` },
      idempotencyKey: `${empty ? "empty" : "low"}:${input.userId}:${Math.floor(now / 86_400_000)}`,
    });
  } catch (error) {
    logger.error("Could not send a balance notice", { cause: serializeError(error) });
  }
}
