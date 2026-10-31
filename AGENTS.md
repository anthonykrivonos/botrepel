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

- Write like a capable, kind narrator who notices concrete details and offers quiet encouragement with occasional dry humor. Take inspiration from Undertale's narration, signs, and clear menus while keeping BotRepel credible to enterprise buyers and welcoming to developers. Every line must work for someone who has never played.
- Let sentences flow naturally, and connect related thoughts with words such as "and", "but", "while", and "so". Longer sentences are welcome when they read well, including constructions like "This is X, and that is Y." Avoid deliberately clipped prose, strings of fragments, or making sentences short for its own sake. Use semicolons and colon-led explanations sparingly, keeping colons where they help with labels or code examples. Do not use em dashes in prose.
- Keep "Make the internet human again." exactly as written.
- Let marketing, onboarding, empty states, and successful setup carry the most personality. Use at most one conspicuous playful beat per screen or marketing section. Small allusions to determination or joining a party are welcome when they fit, but should not become recurring catchphrases. An aside must be removable without losing essential information.
- Preserve every fact, qualification, number, prerequisite, consequence, and available next step, and keep technical terms consistent. Distinguish liveness from identity and capture from approval, and remember that creating keys does not mean installation is complete. Never invent progress, remembered visits, user emotions, or protection the current state does not establish.
- Keep verification instructions, consent, privacy, payments, secrets, destructive actions, and failure recovery calm and literal. State the problem and the available recovery. Never joke about failed verification or imply that a visitor is less human.
- Keep controls and accessible labels specific to their actions. Preserve provider wording, commands, code examples, routes, API fields, error codes, exported SDK errors, and structured-output shapes. Human-readable CLI and developer prose can have warmth while keeping technical instructions exact.
- Borrow storytelling techniques without impersonating characters or copying dialogue. Avoid all-caps or lowercase personas, intentional misspellings, dialogue asterisks, excessive ellipses, and forced game references.
- Apply this voice when adding or changing customer-facing copy, including public docs, metadata, and transactional emails. Leave legal policies, research, internal engineering docs, licenses, and third-party wording unchanged unless explicitly asked. Keep already-effective copy and avoid sweeping unrelated text into a task.
- Omit generic introductions, repeated explanations, and unnecessary implementation details. Use sentence-case headings without trailing periods and title case for buttons and button-styled links. Keep provider labels such as "Continue with Google" and "Continue with GitHub" verbatim.

Calibrate the voice with these examples:

- For an empty state, write "There are no sites yet, and you can create your first one here or run `npx botrepel init` in your app."
- Keep "Page not found" and the literal "Go Home" action, with an optional aside such as "You found an empty room, but there's still a way home."
- Keep the secret reveal instruction "Copy it now. It won't be shown again. Keep it on your server." Brief security instructions and action labels can stay brief when that makes them easier to use.

## Verification and delivery

- Keep tests deterministic and inexpensive. Protect meaningful behavior at the cheapest useful layer. Follow the [testing skill](.claude/skills/testing/SKILL.md); trivial copy, styling, and pass-throughs need no tests.
- Keep exploratory checks, repros, one-off scripts, and reports in `/tmp` or ignored `.scratch/`, and skill learning logs in ignored `.learnings/`; never stage or commit them.
- Reread the diff and report what was verified and any remaining limitation. Do not hide failing tests.
- Create documentation only when requested.
- Do not commit, push, merge, or deploy without authorization. Rebase instead of merging main; never force-push main.
