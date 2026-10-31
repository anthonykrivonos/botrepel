import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SESSION_CHANGED_KEY } from "../account/client";
import { getQueryClient } from "../utils/rpc";

interface RpcProviderProps {
  readonly children: React.ReactNode;
}

/** Another tab signing in or out, or a back-forward cache restore, reloads so no stale account data shows. */
export function RpcProvider({ children }: RpcProviderProps): React.JSX.Element {
  const [client] = useState(getQueryClient);
  useEffect(() => {
    const reset = (): void => {
      client.clear();
      window.location.reload();
    };
    const onStorage = (event: StorageEvent): void => {
      if (event.key === SESSION_CHANGED_KEY) {
        reset();
      }
    };
    const onPageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) {
        reset();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
