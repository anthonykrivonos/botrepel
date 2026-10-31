import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { KeyReveal } from "./KeyReveal";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import { rpc } from "../utils/rpc";

interface NewSiteDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Commas, spaces, or new lines separate domains. */
const parseDomains = (value: string): string[] => value.split(/[\s,]+/).filter(Boolean);

export function NewSiteDialog({ open, onClose }: NewSiteDialogProps): React.JSX.Element {
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("localhost");
  const create = useMutation(rpc.sites.create.mutationOptions());
  const fields = create.error?.data?.fields;

  const close = (): void => {
    create.reset();
    setName("");
    setDomains("localhost");
    onClose();
  };

  return (
    <Dialog open={open} title={create.data ? "Your keys are ready" : "New site"} onClose={close}>
      {create.data ? (
        <div className="flex flex-col gap-6">
          <KeyReveal siteKey={create.data.site.siteKey} secretKey={create.data.secretKey} />
          <Button onClick={close}>Done</Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ name, domains: parseDomains(domains) });
          }}
        >
          <Field label="Name" error={fields?.name}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme"
                required
              />
            )}
          </Field>
          <Field
            label="Domains"
            hint="Where your widget can appear. Separate domains with commas."
            error={fields?.domains}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={domains}
                onChange={(event) => setDomains(event.target.value)}
                placeholder="acme.com, localhost"
              />
            )}
          </Field>
          {create.error && !fields && <p className="text-sm text-danger">{create.error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create Site
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
