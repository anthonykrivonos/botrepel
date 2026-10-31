import { useEffect, useState } from "react";
import { authClient } from "./client";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { useAccount } from "../hooks/useAccount";

type Status =
  | { readonly kind: "enter" }
  | { readonly kind: "claiming" }
  | { readonly kind: "confirm"; readonly code: string }
  | { readonly kind: "approved" }
  | { readonly kind: "denied" }
  | { readonly kind: "error"; readonly message: string };

/** `ABCD1234` → `ABCD-1234`, as the CLI prints it. */
const formatCode = (code: string): string =>
  code
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .replace(/^(.{4})(.+)$/, "$1-$2");

/** Approves a `botrepel` CLI sign-in: the CLI shows a code and opens this page with it. */
export function DevicePage(): React.JSX.Element {
  const account = useAccount();
  const [status, setStatus] = useState<Status>({ kind: "enter" });
  const [entered, setEntered] = useState("");

  const claim = async (raw: string): Promise<void> => {
    const code = formatCode(raw);
    setStatus({ kind: "claiming" });
    // Claiming ties the code to this account; approval is a separate, explicit step.
    const { error } = await authClient().device({ query: { user_code: code } });
    setStatus(
      error
        ? { kind: "error", message: error.error_description || "That code isn't valid. Check the terminal." }
        : { kind: "confirm", code },
    );
  };

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("user_code");
    if (account && code) {
      void claim(code);
    }
  }, [account]);

  const decide = async (approve: boolean, code: string): Promise<void> => {
    const { error } = approve
      ? await authClient().device.approve({ userCode: code })
      : await authClient().device.deny({ userCode: code });
    setStatus(
      error
        ? { kind: "error", message: error.error_description || "Something went wrong. Try again." }
        : { kind: approve ? "approved" : "denied" },
    );
  };

  if (!account) {
    return <main aria-busy="true" className="min-h-dvh" />;
  }
  return (
    <main className="flex min-h-dvh items-center justify-center glow-info-wash px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Logo className="text-lg" />
        <Card className="flex w-full flex-col gap-4 text-center">
          {status.kind === "enter" && (
            <form
              className="flex flex-col gap-4 text-left"
              onSubmit={(event) => {
                event.preventDefault();
                void claim(entered);
              }}
            >
              <h1 className="text-center text-xl">Connect the CLI</h1>
              <Field label="Code from your terminal">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    className="text-center font-mono tracking-widest uppercase"
                    value={entered}
                    onChange={(event) => setEntered(event.target.value)}
                    placeholder="ABCD-1234"
                    autoFocus
                  />
                )}
              </Field>
              <Button type="submit">Continue</Button>
            </form>
          )}
          {status.kind === "claiming" && <p className="text-fg-muted">Checking the code…</p>}
          {status.kind === "confirm" && (
            <>
              <h1 className="text-xl">Allow the BotRepel CLI?</h1>
              <p className="text-sm text-fg-muted">
                It will create sites and write their keys to your project as{" "}
                <span className="text-fg">{account.email}</span>. Only approve a code you see in your own terminal.
              </p>
              <p className="rounded-control bg-well py-3 font-mono text-2xl tracking-widest text-fg">{status.code}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => void decide(false, status.code)}>
                  Deny
                </Button>
                <Button onClick={() => void decide(true, status.code)}>Allow</Button>
              </div>
            </>
          )}
          {status.kind === "approved" && (
            <>
              <h1 className="text-xl text-ok">Connected</h1>
              <p className="text-sm text-fg-muted">Back to your terminal or coding agent. You can close this tab.</p>
            </>
          )}
          {status.kind === "denied" && <p className="text-fg-muted">Denied. The CLI won't get access.</p>}
          {status.kind === "error" && (
            <>
              <p className="text-sm text-danger">{status.message}</p>
              <Button variant="secondary" onClick={() => setStatus({ kind: "enter" })}>
                Enter the Code Again
              </Button>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
