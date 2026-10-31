import { json, methodNotAllowed } from "../apps/web/lib/http";
import { NO_STORE_HEADERS } from "../apps/web/src/shared/constants";

export default {
  fetch(request: Request): Response {
    if (request.method === "GET") {
      return json({ status: "ok" });
    }
    if (request.method === "HEAD") {
      return new Response(null, { headers: { "Content-Type": "application/json", ...NO_STORE_HEADERS } });
    }
    return methodNotAllowed("GET, HEAD");
  },
};
