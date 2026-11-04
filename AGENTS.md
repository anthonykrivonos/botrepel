# BotRepel

Human verification for websites in the AI era.

## Work

- Before task work, run `bunx --bun skills@1.7.4 list --json` and verify every `skills-lock.json` entry has a readable `.agents/skills/<name>/SKILL.md` and is discoverable by the agent. If setup fails, report the blocker and stop. Read only skills relevant to the task.
- Use `skills-lock.json` as the sole skills inventory. When adding a skill, install at project scope with `bunx --bun skills@1.7.4 add '<source>' --skill '<name>' --agent codex claude-code --yes`. Let the CLI maintain `.agents/skills/`, agent links, and `skills-lock.json`. Keep repo-specific routing and requirements in `AGENTS.md` rather than editing upstream skill files.
- Finish the requested change without unrelated cleanup. Inspect existing code first; preserve other agents' work. Make routine decisions yourself and ask only when ambiguity materially changes the result.
- Use Bun for dependencies, scripts, builds, and tests. Follow the installed versions, ESLint, and Prettier; prefer platform APIs and existing dependencies.
- Read only relevant topic docs in [docs/knowledge/](docs/knowledge/). Read [liveness research](docs/knowledge/liveness-research.md) before work on verification, camera capture, the threat model, or biometric privacy.

## Code and design

- Reuse existing components, hooks, schemas, helpers, and types before adding anything. Consolidate repeated behavior where it has one meaning; avoid speculative abstractions, parallel implementations, and boolean-heavy components.
- When asked to copy or adapt a paradigm, interaction, or workflow from another product, use [reverse-engineer-anything](.agents/skills/reverse-engineer-anything/SKILL.md) to inspect the reference and distinguish observed behavior from inference.
- Read DESIGN.md before UI or branding work. Follow its tokens, primitives, and rules, and update it in the same change when a shared design decision changes.
- Keep one React component per file. Browser hooks belong in `src/hooks/`, helpers in `src/utils/`.
- Keep browser-safe rules and Zod schemas in `src/shared/`, I/O in `lib/`, and entrypoints thin. Web and API share business logic; derive contracts from the same schemas.
- Use the Result/domain-error helpers in `src/shared/result.ts` and the validated `env` from `lib/env.ts` (the only reader of `process.env` on the server). Await server promises. Use parameterized SQL and bounded queries. Log through `Logger`; never log secrets, personal data, or raw verification signals.
- Verification is security-sensitive: treat every client signal as untrusted, verify server-side, keep tokens short-lived and single-use, and never weaken the CSP in `vercel.json` without a stated reason.

## Copy

- Write public copy in short, complete sentences. Keep it objective and neutral. State what the product does, what it stores, what it costs, and what the reader can do next.
- Do not use marketing slogans or playful asides. Do not use em dashes. Do not use contrast formulas such as "It is X, not Y" or "not just X, but Y". When a limit matters, give it its own sentence.
- Preserve every fact, qualification, number, prerequisite, consequence, and available next step, and keep technical terms consistent. Distinguish liveness from identity and capture from approval, and remember that creating keys does not mean installation is complete. Never invent progress, remembered visits, user emotions, or protection the current state does not establish.
- Keep verification instructions, consent, privacy, payments, secrets, destructive actions, and failure recovery calm and literal. State the problem and the available recovery. Never joke about failed verification or imply that a visitor is less human.
- Keep controls and accessible labels specific to their actions. Preserve provider wording, commands, code examples, routes, API fields, error codes, exported SDK errors, and structured-output shapes.
- Apply this voice when adding or changing customer-facing copy, including public docs, metadata, and transactional emails. Leave legal policies, research, internal engineering docs, licenses, and third-party wording unchanged unless explicitly asked.

Examples:

- Empty state: "There are no sites yet. Create one here, or run `npx botrepel init` in your app."
- Missing page: heading "Page not found", body "This address does not match a page.", action "Go Home".
- Secret reveal: "Copy it now. It won't be shown again. Keep it on your server."

## Verification and delivery

- Keep tests deterministic and inexpensive. Protect meaningful behavior at the cheapest useful layer. Follow the [testing skill](.claude/skills/testing/SKILL.md); trivial copy, styling, and pass-throughs need no tests.
- Keep exploratory checks, repros, one-off scripts, and reports in `/tmp` or ignored `.scratch/`, and skill learning logs in ignored `.learnings/`; never stage or commit them.
- Reread the diff and report what was verified and any remaining limitation. Do not hide failing tests.
- Create documentation only when requested.
- Do not commit, push, merge, or deploy without authorization. Rebase instead of merging main; never force-push main.
