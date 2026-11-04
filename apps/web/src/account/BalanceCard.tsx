import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ASSURANCES, ASSURANCE_LABELS } from "../shared/assurance";
import { formatDollars, TOP_UP_DOLLARS } from "../shared/pricing";
import { usageCsv } from "../shared/usage-csv";
import { download } from "../utils/download";
import { rpc } from "../utils/rpc";

export function BalanceCard(): React.JSX.Element {
  const summary = useQuery(rpc.billing.summary.queryOptions());
  const sites = useQuery(rpc.sites.list.queryOptions());
  const checkout = useMutation(rpc.billing.checkout.mutationOptions());
  // Back from Stripe: the webhook may land a moment later, so say so rather than show a stale balance.
  const [returned, setReturned] = useState<string | null>(null);
  useEffect(() => setReturned(new URLSearchParams(window.location.search).get("topup")), []);
  useEffect(() => {
    if (checkout.data) {
      window.location.assign(checkout.data.url);
    }
  }, [checkout.data]);
  const balance = summary.data?.balanceMicros ?? 0;
  const totals = Object.fromEntries(
    ASSURANCES.map((tier) => [
      tier,
      summary.data?.usage.filter((row) => row.tier === tier).reduce((sum, row) => sum + row.quantity, 0) ?? 0,
    ]),
  );
  const downloadUsage = (): void => {
    const names = new Map(sites.data?.map((site) => [site.id, site.name]));
    download("botrepel-usage.csv", "text/csv", usageCsv(summary.data?.usage ?? [], names));
  };
  return (
    <Card className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-sm text-fg-subtle">Credit</p>
        <p className="font-mono text-3xl text-fg">{summary.data ? formatDollars(balance, 4) : "…"}</p>
        {summary.data && balance <= 0 && (
          <div className="mt-2">
            <Badge tone="danger">Out of credit: invisible checks only</Badge>
          </div>
        )}
        {returned === "success" && (
          <div className="mt-2">
            <Badge tone="ok">Payment received. Credit appears within a minute.</Badge>
          </div>
        )}
        {summary.data?.canTopUp && (
          <div className="mt-4 flex flex-wrap gap-2">
            {TOP_UP_DOLLARS.map((dollars) => (
              <Button
                key={dollars}
                variant="secondary"
                size="sm"
                disabled={checkout.isPending}
                onClick={() => checkout.mutate({ dollars })}
              >
                Add ${dollars}
              </Button>
            ))}
          </div>
        )}
        {checkout.error && <p className="mt-2 text-sm text-danger">{checkout.error.message}</p>}
      </div>
      <div className="flex flex-col gap-3 sm:items-end">
        <dl className="grid grid-cols-3 gap-6 text-sm">
          {ASSURANCES.map((tier) => (
            <div key={tier}>
              <dt className="text-fg-subtle">{ASSURANCE_LABELS[tier]}</dt>
              <dd className="font-mono text-fg">{totals[tier]?.toLocaleString("en-US")}</dd>
            </div>
          ))}
        </dl>
        <Button variant="ghost" size="sm" disabled={!summary.data} onClick={downloadUsage}>
          Download 30-Day CSV
        </Button>
      </div>
    </Card>
  );
}
