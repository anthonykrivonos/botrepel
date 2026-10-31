import type { Assurance } from "./assurance";
import { MICROS_PER_DOLLAR } from "./pricing";

const MS_PER_HOUR = 3_600_000;

/** Verifications charged for one site and tier in one hour. */
export interface UsageRow {
  readonly siteId: string;
  readonly tier: Assurance;
  /** Hours since the Unix epoch. */
  readonly hour: number;
  readonly quantity: number;
  readonly amountMicros: number;
}

/** Quoted when needed, and a leading formula character neutralized so spreadsheets show it as text. */
function cell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One line per site, tier, and hour, with the site's name when it still exists. */
export function usageCsv(rows: readonly UsageRow[], siteNames: ReadonlyMap<string, string>): string {
  const lines = rows.map((row) =>
    [
      new Date(row.hour * MS_PER_HOUR).toISOString(),
      row.siteId,
      siteNames.get(row.siteId) ?? "",
      row.tier,
      String(row.quantity),
      (row.amountMicros / MICROS_PER_DOLLAR).toFixed(6),
    ]
      .map(cell)
      .join(","),
  );
  return ["hour_utc,site_id,site_name,tier,verifications,amount_usd", ...lines].join("\r\n") + "\r\n";
}
