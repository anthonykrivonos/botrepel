import type { Assurance } from "./assurance";

/** Money is integer micro-dollars everywhere: $1 = 1,000,000 µ$. */
export const MICROS_PER_DOLLAR = 1_000_000;

/** Every new account starts with this much free usage. */
export const FREE_CREDIT_MICROS = 5 * MICROS_PER_DOLLAR;

/** Charged per successful siteverify, by the assurance the token proved. */
export const PRICE_MICROS: Readonly<Record<Assurance, number>> = {
  invisible: 500,
  presence: 2_000,
  liveness: 20_000,
};

export function formatDollars(micros: number, digits = 2): string {
  return `$${(micros / MICROS_PER_DOLLAR).toFixed(digits)}`;
}

/** Top-up amounts the dashboard offers, in dollars. */
export const TOP_UP_DOLLARS = [10, 50, 200] as const;

/** Prices per thousand checks read better than tiny per-check amounts. */
export const formatPerThousand = (micros: number): string => formatDollars(micros * 1000);
