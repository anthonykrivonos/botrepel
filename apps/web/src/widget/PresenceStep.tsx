import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { Button } from "../components/Button";

interface PresenceStepProps {
  readonly presenceId: string;
  readonly onToken: (token: string) => void;
  /** No pass, or the person would rather take the light check. */
  readonly onLightCheck: () => void;
}

/** One tap with a Human Pass: Face ID, Touch ID, Windows Hello, or a phone. */
export function PresenceStep({ presenceId, onToken, onLightCheck }: PresenceStepProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const usePass = async (): Promise<void> => {
    setPending(true);
    setError(null);
    try {
      const options = await fetch("/v1/presence/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presenceId }),
      });
      if (!options.ok) {
        throw new Error(((await options.json()) as { error?: string }).error ?? "This check expired.");
      }
      const response = await startAuthentication({ optionsJSON: await options.json() });
      const verified = await fetch("/v1/presence/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presenceId, response }),
      });
      const body = (await verified.json()) as { token?: string; error?: string };
      if (!verified.ok || !body.token) {
        throw new Error(body.error ?? "That Human Pass couldn't be used.");
      }
      onToken(body.token);
    } catch (cause) {
      // Cancelling the browser's passkey sheet lands here too; the light check is always available.
      setError(cause instanceof Error && cause.name !== "NotAllowedError" ? cause.message : null);
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-surface p-6 text-center text-fg">
      <div className="flex max-w-sm flex-col gap-4">
        <h1 className="text-xl">Confirm you're human</h1>
        <p className="text-sm text-fg-muted">
          Use your Human Pass with one tap, or take a camera check with a two-second color sequence and a head roll.
        </p>
        <Button disabled={pending} onClick={() => void usePass()}>
          Use Human Pass
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onLightCheck}>
          Take the Light Check Instead
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
