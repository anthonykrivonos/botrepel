import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";

interface PassOfferProps {
  readonly anchorId: string;
  readonly onDone: (created: boolean) => void;
}

/**
 * After a clear light check: create a Human Pass to skip it next time, on any BotRepel site. The
 * passkey is made in a first-party popup, because browsers (Safari) won't create one in a frame.
 */
export function PassOffer({ anchorId, onDone }: PassOfferProps): React.JSX.Element {
  const [waiting, setWaiting] = useState(false);
  // The popup both reports success and then closes; finish only once.
  const finished = useRef(false);
  const finish = useRef(onDone);
  finish.current = (created: boolean) => {
    if (!finished.current) {
      finished.current = true;
      onDone(created);
    }
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ type?: string }>): void => {
      if (event.origin === window.location.origin && event.data?.type === "botrepel:pass-created") {
        finish.current(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const open = (): void => {
    const popup = window.open(
      `/pass/new?anchor=${encodeURIComponent(anchorId)}`,
      "botrepel-pass",
      "popup,width=440,height=560",
    );
    if (!popup) {
      finish.current(false);
      return;
    }
    setWaiting(true);
    // Closing the popup without creating a pass just finishes the check.
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        finish.current(false);
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-surface p-6 text-center text-fg">
      <div className="flex max-w-sm flex-col gap-4">
        <h1 className="text-xl">You're verified</h1>
        <p className="text-sm text-fg-muted">
          Create a Human Pass to skip the light check next time, on any site that uses BotRepel. It's a passkey on your
          device. It doesn't contain your face or name, and sites can't link you across them.
        </p>
        <Button disabled={waiting} onClick={open}>
          {waiting ? "Finish in the new window…" : "Create Human Pass"}
        </Button>
        <Button variant="ghost" onClick={() => finish.current(false)}>
          Not Now
        </Button>
      </div>
    </div>
  );
}
