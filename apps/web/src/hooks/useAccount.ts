import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { rpc, type RouterOutputs } from "../utils/rpc";

/** The signed-in account, undefined while loading; sends anyone signed out to the login page and back here. */
export function useAccount(): RouterOutputs["me"] | undefined {
  const me = useQuery(rpc.me.queryOptions());
  useEffect(() => {
    if (me.isSuccess && !me.data) {
      const next = window.location.pathname + window.location.search;
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [me.isSuccess, me.data]);
  return me.data;
}
