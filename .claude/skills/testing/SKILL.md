---
name: testing
description: Choose and run focused BotRepel checks, reuse test helpers, or diagnose a failing suite. Use when changing behavior or working on tests; trivial copy and styling do not require new tests.
---

# Testing BotRepel

1. Extend existing coverage for meaningful regressions at the cheapest layer:
   pure rules in `tests/unit/`, API behavior in `tests/integration/`, browser
   behavior in `tests/e2e/`. Trivial copy, styling, pass-throughs,
   implementation details, and unchanged behavior need no new tests.
2. Run affected checks locally; CI owns the routine gates. Report skipped cases
   accurately. Do not rerun passing checks without a relevant change.
3. Integration tests call `handleApi` (or a `createApi` instance) with plain
   `Request`s; no server is needed. Browser specs run against the production
   build served by `preview.ts` on port 3100. Tag layout assertions `@phone`.
4. Assert durable outcomes, not transient rendering states. Use bounded
   assertions, `setSystemTime` reset in `finally`, and `page.clock` for browser
   timers. Avoid arbitrary sleeps, retries, or longer timeouts that conceal
   failures.
5. `tests/setup.ts` clears environment that changes behavior and silences the
   console; `TEST_LOGS=1` shows logs.

## Commands

Start with one case, such as
`bun test apps/web/tests/integration/api.test.ts -t "health"`. Run
typecheck/lint for affected code and formatting for changed files. Build when
changing build inputs, bundling, routing, or generated output.

For browser behavior, use `bun run test:e2e --project=desktop`; use
`--project=phone` for layout changes. Do not run builds and Playwright
concurrently: both use `apps/web/dist`.
