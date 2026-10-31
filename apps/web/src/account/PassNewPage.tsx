import { startRegistration } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Logo } from "../components/Logo";

type Status = "ready" | "working" | "created" | "error";

/** The popup that creates a Human Pass; first-party, so every browser allows passkey creation. */
export function PassNewPage(): React.JSX.Element {
  const [status, setStatus] = useState<Status>("ready");
  const [message, setMessage] = useState("");
  // Read after hydration: the page is pre-rendered without a query string.
  const [anchorId, setAnchorId] = useState("");
  useEffect(() => setAnchorId(new URLSearchParams(window.location.search).get("anchor") ?? ""), []);

  const create = async (): Promise<void> => {
    setStatus("working");
    try {
      const options = await fetch("/v1/pass/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anchorId }),
      });
      if (!options.ok) {
        throw new Error(((await options.json()) as { error?: string }).error ?? "This link expired.");
      }
      const response = await startRegistration({ optionsJSON: await options.json() });
      const verified = await fetch("/v1/pass/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anchorId, response }),
      });
      if (!verified.ok) {
        throw new Error(((await verified.json()) as { error?: string }).error ?? "The passkey couldn't be saved.");
      }
      setStatus("created");
      window.opener?.postMessage({ type: "botrepel:pass-created" }, window.location.origin);
      setTimeout(() => window.close(), 1200);
    } catch (cause) {
      setStatus("error");
      setMessage(
        cause instanceof Error && cause.name !== "NotAllowedError" ? cause.message : "Cancelled. You can try again.",
      );
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo className="text-lg" />
        <Card className="flex w-full flex-col gap-4 text-center">
          <h1 className="text-xl">{status === "created" ? "Human Pass created" : "Create your Human Pass"}</h1>
          {status === "created" ? (
            <p className="text-sm text-ok">Next time, it's one tap. You can close this window.</p>
          ) : (
            <>
              <p className="text-sm text-fg-muted">
                Your device saves a passkey and asks for Face ID, Touch ID, or your PIN to use it. BotRepel never sees
                your face or fingerprint.
              </p>
              <Button disabled={status === "working" || !anchorId} onClick={() => void create()}>
                Create Human Pass
              </Button>
              {status === "error" && <p className="text-sm text-danger">{message}</p>}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
