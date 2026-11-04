import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AccountNav } from "./AccountNav";
import { authClient, signOut } from "./client";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Dialog } from "../components/Dialog";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import { useAccount } from "../hooks/useAccount";
import { download } from "../utils/download";
import { rpc, trpcClient } from "../utils/rpc";

/** Downloads the account export as a JSON file. */
async function downloadExport(): Promise<void> {
  const data = await trpcClient.account.export.query();
  download("botrepel-export.json", "application/json", JSON.stringify(data, null, 2));
}

export function SettingsPage(): React.JSX.Element {
  const account = useAccount();
  const tokens = useQuery(rpc.account.cliTokens.queryOptions());
  const revoke = useMutation(rpc.account.revokeCliToken.mutationOptions({ onSuccess: () => void tokens.refetch() }));
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!account) {
    return <main id="content" aria-busy="true" className="min-h-dvh" />;
  }

  const deleteAccount = async (): Promise<void> => {
    setError(null);
    const { error: failure } = await authClient().deleteUser();
    if (failure) {
      // Deleting needs a recent sign-in; send them through it and back here.
      setError(
        failure.status === 400 || failure.status === 403
          ? "For your safety, sign in again, then delete your account."
          : (failure.message ?? "Couldn't delete the account. Try again."),
      );
      return;
    }
    await signOut();
  };

  return (
    <>
      <AccountNav email={account.email} />
      <main id="content" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <h1 className="font-display text-[2.5rem] leading-tight font-normal">Settings</h1>

        <Card className="flex flex-col gap-4">
          <h2 className="text-base">CLI sign-ins</h2>
          <p className="text-sm text-fg-muted">
            Each computer that ran `npx botrepel` has its own token. Revoke any you don't recognize.
          </p>
          {tokens.data?.length === 0 && <p className="text-sm text-fg-subtle">No CLI sign-ins.</p>}
          <ul className="flex flex-col divide-y divide-line">
            {tokens.data?.map((token) => (
              <li key={token.id} className="flex items-center gap-4 py-3 text-sm">
                <code className="flex-1 text-fg">{token.prefix}…</code>
                <span className="text-fg-subtle">
                  {token.lastUsedAt ? `Used ${new Date(token.lastUsedAt).toLocaleDateString()}` : "Never used"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate({ id: token.id })}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-base">Your data</h2>
          <p className="text-sm text-fg-muted">
            Download your sites, settings, and usage as JSON. Secret keys aren't included.
          </p>
          <div>
            <Button variant="secondary" onClick={() => void downloadExport()}>
              Download Export
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-base">Delete account</h2>
          <p className="text-sm text-fg-muted">
            This deletes your sites, keys, credit, and usage. Widgets that use those site keys stop working immediately.
            Deletion is permanent. Remaining credit is not refunded.
          </p>
          <div>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              Delete Account
            </Button>
          </div>
        </Card>

        <Dialog open={deleting} title="Delete your account" onClose={() => setDeleting(false)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void deleteAccount();
            }}
          >
            <Field label={`Type ${account.email} to confirm`}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              )}
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={confirm.trim().toLowerCase() !== account.email.toLowerCase()}
              >
                Delete Forever
              </Button>
            </div>
          </form>
        </Dialog>
      </main>
    </>
  );
}
