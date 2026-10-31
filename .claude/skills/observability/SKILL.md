---
name: observability
description: Extend or debug BotRepel logging and metrics when existing request logs cannot explain an operational outcome. Covers what may and may not be logged around verification, keys, and liveness media.
---

# Observability for BotRepel

Reuse the request log before adding instrumentation. A feature does not automatically need a
new log line, metric, test, or document.

| Existing coverage | Owner |
|---|---|
| One summary line per request (`METHOD /path STATUS`, request id, ms) | `withRequestId` in `lib/api.ts` |
| Structured logs (JSON lines in production) | `Logger` in `lib/logger.ts` |
| Per-request context (`requestId`, ids added by handlers) | `noteRequest` in `lib/request-log.ts` |
| HTTP 5xx spikes and resource usage | Vercel |

- Log unexpected failures once, at the boundary with useful context, through a labeled `Logger`
  with `cause: serializeError(error)`. Expected validation, not-found, and conflict responses
  need no extra log; the request summary already records the status and reason.
- Add context with `noteRequest` (site id, action, assurance, decision reason) rather than
  separate lines.
- **Never log:**
  - secrets, secret keys, tokens, session cookies, or device codes;
  - emails or other personal data;
  - camera frames, face crops, or any array of pixel or landmark data;
  - WebAuthn credential ids or public keys, or Human Pass pseudonyms tied to a site;
  - raw IP addresses (hash them as the rate limiter does).
  Use ids, statuses, counts, and enum reasons.
- Liveness may record only the scalar, non-biometric scores in `livenessStat` (lag, gain spread,
  specular ratio, SNR, decision). If a debugging session needs frames, capture them locally from
  your own face in a scratch tool. Never add a production code path that keeps them.
- Monitoring failures must never change a verification result or block a request.
- Test changed suppression, throttling, or redaction logic. Simple logging calls need no tests.
