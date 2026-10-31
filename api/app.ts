import { resolve } from "node:path";
import type { handleApi as HandleApi } from "../apps/web/lib/api";

/** A variable path, so Vercel's file tracer skips the sources and ships only the bundle. @see apps/web/build.ts */
const bundle = resolve(process.cwd(), "apps/web/.build/api.js");

let handler: Promise<typeof HandleApi> | undefined;

function loadHandler(): Promise<typeof HandleApi> {
  handler ??= import(bundle).then(
    (module: { handleApi: typeof HandleApi }) => module.handleApi,
    (error: unknown) => {
      handler = undefined;
      // ResolveMessage's fields are not enumerable, so logging the object prints {}.
      const { name, message } = error instanceof Object ? (error as Error) : { name: "Error", message: String(error) };
      console.error(`Could not load the API bundle ${bundle}: ${name}: ${message}`);
      throw error;
    },
  );
  return handler;
}

export default {
  async fetch(request: Request): Promise<Response> {
    return (await loadHandler())(request);
  },
};
