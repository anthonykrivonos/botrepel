import { TOKEN_HEADER } from "@botrepel/protocol";
import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import type { BotRepelHandle, BotRepelProps } from "./BotRepel";

export interface BotRepelState {
  /** The current token, or null until the check passes (and again after it expires). */
  readonly token: string | null;
  /** Spread into `<BotRepel>`: `<BotRepel siteKey={…} action="login" {...botrepel.props} />`. */
  readonly props: Pick<BotRepelProps, "onVerify" | "onExpire" | "onError"> & {
    readonly ref: RefObject<BotRepelHandle | null>;
  };
  /** For fetch-based auth clients: `fetchOptions: { headers: botrepel.headers }`. */
  readonly headers: Readonly<Record<string, string>>;
  /** Clears the token and checks again, e.g. after a failed sign-in. */
  reset(): void;
}

/** The widget's token as state, for sign-in calls made with fetch rather than a native form. */
export function useBotRepel(): BotRepelState {
  const ref = useRef<BotRepelHandle>(null);
  const [token, setToken] = useState<string | null>(null);
  const clear = useCallback(() => setToken(null), []);
  const reset = useCallback(() => {
    setToken(null);
    ref.current?.reset();
  }, []);
  const props = useMemo(
    () => ({ ref, onVerify: (value: string) => setToken(value), onExpire: clear, onError: clear }),
    [clear],
  );
  const headers = useMemo((): Record<string, string> => (token ? { [TOKEN_HEADER]: token } : {}), [token]);
  return { token, props, headers, reset };
}
