import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { KeyReveal } from "./KeyReveal";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CopyField } from "../components/CopyField";
import { Dialog } from "../components/Dialog";
import { rpc, type RouterOutputs } from "../utils/rpc";

interface SiteKeysProps {
  readonly site: RouterOutputs["sites"]["list"][number];
}

export function SiteKeys({ site }: SiteKeysProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const rotate = useMutation(rpc.sites.rotateSecret.mutationOptions());
  const close = (): void => {
    setConfirming(false);
    rotate.reset();
  };
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base">Keys</h2>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-fg-subtle">Site key</p>
        <CopyField value={site.siteKey} label="Copy site key" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-fg-subtle">Secret key</p>
          <p className="font-mono text-sm text-fg">{site.secretPrefix}…</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          Rotate Secret
        </Button>
      </div>
      <Dialog open={confirming} title={rotate.data ? "New secret key" : "Rotate secret key"} onClose={close}>
        {rotate.data ? (
          <div className="flex flex-col gap-6">
            <KeyReveal siteKey={rotate.data.site.siteKey} secretKey={rotate.data.secretKey} />
            <Button onClick={close}>Done</Button>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-fg-muted">
              The current secret keeps working for 24 hours, so you can deploy the new one.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="danger" disabled={rotate.isPending} onClick={() => rotate.mutate({ siteId: site.id })}>
                Rotate
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Card>
  );
}
