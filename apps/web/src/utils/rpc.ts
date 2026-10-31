import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, httpLink, splitLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../lib/trpc/router";

const STALE_TIME_MS = 15_000;
const CACHE_TIME_MS = 5 * 60_000;

/** A write to one router refreshes the queries that show its results. */
const related: Readonly<Record<string, readonly string[]>> = {
  sites: ["sites", "usage"],
  billing: ["billing", "usage", "sites"],
};

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: typeof window === "undefined" ? Infinity : CACHE_TIME_MS,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        const path = mutation.options.mutationKey?.[0];
        if (!Array.isArray(path) || typeof path[0] !== "string") {
          return;
        }
        const scopes = related[path[0]] ?? [path[0]];
        void client.invalidateQueries({
          predicate: (item) => Array.isArray(item.queryKey[0]) && scopes.includes(String(item.queryKey[0][0])),
        });
      },
    }),
  });
  return client;
}

let browserClient: QueryClient | undefined;

/** One client in the browser; a fresh one per server render. */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  return (browserClient ??= createQueryClient());
}

/** Reads are batched; writes go alone. POST throughout, so inputs stay out of URLs. */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "mutation",
      true: httpLink({ url: "/api/trpc", methodOverride: "POST" }),
      false: httpBatchLink({ url: "/api/trpc", methodOverride: "POST", maxItems: 10 }),
    }),
  ],
});

export const rpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient: getQueryClient });

export type RouterOutputs = inferRouterOutputs<AppRouter>;
