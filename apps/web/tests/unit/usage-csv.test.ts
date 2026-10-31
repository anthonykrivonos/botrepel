import { expect, test } from "bun:test";
import { usageCsv } from "../../src/shared/usage-csv";

test("usage CSV has one escaped row per entry, in dollars", () => {
  const csv = usageCsv(
    [
      { siteId: "s1", tier: "liveness", hour: 480_000, quantity: 3, amountMicros: 60_000 },
      { siteId: "gone", tier: "invisible", hour: 480_001, quantity: 1, amountMicros: 500 },
    ],
    new Map([["s1", '=Acme, "prod"']]),
  );
  expect(csv.split("\r\n")).toEqual([
    "hour_utc,site_id,site_name,tier,verifications,amount_usd",
    `2024-10-04T00:00:00.000Z,s1,"'=Acme, ""prod""",liveness,3,0.060000`,
    "2024-10-04T01:00:00.000Z,gone,,invisible,1,0.000500",
    "",
  ]);
});
