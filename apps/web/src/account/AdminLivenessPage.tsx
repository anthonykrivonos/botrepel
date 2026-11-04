import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AccountNav } from "./AccountNav";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useAccount } from "../hooks/useAccount";
import { rpc } from "../utils/rpc";

const RANGES = [7, 30, 90] as const;
const QUANTILE_LABELS = ["p5", "p25", "p50", "p75", "p95"];

const format = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(3));

export function AdminLivenessPage(): React.JSX.Element {
  const account = useAccount();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const calibration = useQuery({
    ...rpc.admin.liveness.queryOptions({ days }),
    enabled: Boolean(account),
    retry: false,
  });

  if (!account) {
    return <main id="content" aria-busy="true" className="min-h-dvh" />;
  }
  const data = calibration.data;
  return (
    <>
      <AccountNav email={account.email} />
      <main id="content" className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl">Liveness calibration</h1>
            <p className="text-sm text-fg-muted">Light-check scores by decision. Tune THRESHOLDS from real devices.</p>
          </div>
          <div className="flex gap-2" role="group" aria-label="Range">
            {RANGES.map((range) => (
              <Button
                key={range}
                size="sm"
                variant={range === days ? "secondary" : "ghost"}
                aria-pressed={range === days}
                onClick={() => setDays(range)}
              >
                {range} Days
              </Button>
            ))}
          </div>
        </header>
        {calibration.error && <p className="text-danger">{calibration.error.message}</p>}
        {data && (
          <>
            <Card>
              <p className="mb-4 text-sm text-fg-subtle">
                {data.total.toLocaleString("en-US")} checks since {data.since}
                {data.truncated && " (newest only)"}
              </p>
              {data.total === 0 ? (
                <p className="text-fg-muted">No light checks yet.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  {data.outcomes.map((outcome) => (
                    <div key={`${outcome.decision}:${outcome.reason}`}>
                      <dt className="text-fg-subtle">
                        {outcome.decision}
                        {outcome.reason && ` · ${outcome.reason}`}
                      </dt>
                      <dd className="font-mono text-fg">{outcome.count.toLocaleString("en-US")}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
            {data.total > 0 && (
              <div className="overflow-x-auto rounded-card border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="text-fg-subtle">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2 font-normal">Metric</th>
                      <th className="px-4 py-2 font-normal">Threshold</th>
                      <th className="px-4 py-2 font-normal">Decision</th>
                      {QUANTILE_LABELS.map((label) => (
                        <th key={label} className="px-4 py-2 text-right font-normal">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.metrics.flatMap((metric) =>
                      Object.entries(metric.byDecision).map(([decision, values], index) => (
                        <tr key={`${metric.metric}:${decision}`} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-2 text-fg">{index === 0 ? metric.metric : ""}</td>
                          <td className="px-4 py-2 font-mono text-fg-muted">{index === 0 ? metric.threshold : ""}</td>
                          <td className="px-4 py-2 text-fg-muted">{decision}</td>
                          {values.map((value, column) => (
                            <td key={QUANTILE_LABELS[column]} className="px-4 py-2 text-right font-mono text-fg">
                              {format(value)}
                            </td>
                          ))}
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
