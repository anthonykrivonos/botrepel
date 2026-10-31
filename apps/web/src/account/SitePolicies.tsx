import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { ASSURANCES, ASSURANCE_LABELS, type Assurance } from "../shared/assurance";
import { formatDollars, PRICE_MICROS } from "../shared/pricing";
import { rpc, type RouterOutputs } from "../utils/rpc";

interface SitePoliciesProps {
  readonly site: RouterOutputs["sites"]["list"][number];
}

interface Row {
  readonly action: string;
  readonly assurance: Assurance;
}

/** The minimum check per action; risk can raise it, never lower it. */
export function SitePolicies({ site }: SitePoliciesProps): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(() =>
    Object.entries(site.policies).map(([action, assurance]) => ({ action, assurance })),
  );
  const [domains, setDomains] = useState(site.domains.join(", "));
  const [onUnpaid, setOnUnpaid] = useState(site.onUnpaid);
  const update = useMutation(rpc.sites.update.mutationOptions());
  const fields = update.error?.data?.fields;

  const setRow = (index: number, row: Partial<Row>): void =>
    setRows((current) => current.map((existing, i) => (i === index ? { ...existing, ...row } : existing)));

  const save = (): void =>
    update.mutate({
      siteId: site.id,
      domains: domains.split(/[\s,]+/).filter(Boolean),
      policies: Object.fromEntries(rows.filter((row) => row.action).map((row) => [row.action, row.assurance])),
      onUnpaid,
    });

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base">Domains</h2>
        <Input aria-label="Domains" value={domains} onChange={(event) => setDomains(event.target.value)} />
        {fields?.domains && <p className="text-xs text-danger">{fields.domains}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base">Checks per action</h2>
        <p className="-mt-1 text-sm text-fg-muted">
          Match the action your form passes. <code className="text-fg">*</code> covers every other action.
        </p>
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <Input
              aria-label="Action"
              className="font-mono"
              value={row.action}
              disabled={row.action === "*"}
              onChange={(event) => setRow(index, { action: event.target.value.toLowerCase() })}
              placeholder="signup"
            />
            <Select
              aria-label={`Check for ${row.action || "this action"}`}
              value={row.assurance}
              onChange={(event) => setRow(index, { assurance: event.target.value as Assurance })}
            >
              {ASSURANCES.map((level) => (
                <option key={level} value={level}>
                  {ASSURANCE_LABELS[level]} ({formatDollars(PRICE_MICROS[level] * 1000)}/1k)
                </option>
              ))}
            </Select>
            {row.action !== "*" && (
              <Button
                variant="ghost"
                aria-label={`Remove ${row.action}`}
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {fields?.policies && <p className="text-xs text-danger">{fields.policies}</p>}
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRows([...rows, { action: "", assurance: "presence" }])}
          >
            Add Action
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-base">When credit runs out</h2>
        <Select
          aria-label="When credit runs out"
          value={onUnpaid}
          onChange={(event) => setOnUnpaid(event.target.value as typeof onUnpaid)}
        >
          <option value="degrade">Keep serving invisible checks (marked unpaid)</option>
          <option value="fail_closed">Refuse new checks</option>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-3">
        {update.isSuccess && <span className="text-sm text-ok">Saved</span>}
        {update.error && !fields && <span className="text-sm text-danger">{update.error.message}</span>}
        <Button disabled={update.isPending} onClick={save}>
          Save
        </Button>
      </div>
    </Card>
  );
}
