# BotRepel

BotRepel provides human verification for websites in the AI era, so you can check
that there's a real person on the other side without puzzles, tracking, or friction.

## Develop

Requires Bun 1.4.3 or newer.

```sh
bun install
cp .env.example .env
bun run dev
```

Open <http://localhost:3000>. Override the local port with `PORT`.

## Verify

Choose the checks for the behavior changed, for example:

```sh
bun run typecheck
bun test apps/web/tests/integration/api.test.ts
bun run test:e2e --project=desktop
```

CI runs the full checks. `bun run check` and `bun run check:full` are available
on demand.

## Deploy

Import into Vercel with the repository root and the **Other** framework preset.
`vercel.json` configures installation, build, routing, security headers, the
Bun runtime, and an hourly cron at `/api/cron/purge`.

Production builds refuse to finish until these are set:

- `SITE_URL`, an HTTPS origin with no path, such as `https://botrepel.com`
- `DATABASE_URL`, a Postgres connection string
- `BETTER_AUTH_SECRET`, `CHALLENGE_SECRET`, `PASS_PSEUDONYM_KEY`, and `CRON_SECRET`, each at least 32 random characters
- One sign-in method: GitHub (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`), Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), or email (`RESEND_API_KEY` and `EMAIL_FROM`)

Set OAuth credentials for Production only. Preview URLs change with each deployment, so they are a poor fit for OAuth callbacks. Set `RESEND_API_KEY` and `EMAIL_FROM` on Preview if that environment should offer a magic link.

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` together, or leave both empty. The home page demo needs `PUBLIC_DEMO_SITE_KEY` and `DEMO_SECRET_KEY` from `bun run demo:seed --print botrepel.com`, run against the production database. `ADMIN_EMAILS` opens `/admin/liveness`. `SEO_NOINDEX=1` keeps a production build out of search engines.

## Layout

- `apps/web/src/`: the React app. `frontend.tsx` hydrates pre-rendered HTML;
  `index.ts` is the dev server with hot reload. Browser-safe rules and Zod
  schemas live in `src/shared/`, hooks in `src/hooks/`, helpers in `src/utils/`.
- `apps/web/lib/`: server code. `env.ts` is the only reader of environment
  variables, `api.ts` routes `/api/*` with a declarative table and logs one
  line per request, `logger.ts` writes JSON lines in production.
- `apps/web/build.ts`: bundles the frontend, pre-renders `src/site/content.ts`
  pages, writes `robots.txt`/`sitemap.xml`, and bundles the API to
  `.build/api.js` for `api/app.ts`.
- `apps/web/server.ts`: local static serving and API routes that mirror
  `vercel.json` (headers, redirects, clean URLs); `preview.ts` serves the
  production build.
- `api/`: Vercel functions. `health.ts` is standalone; `app.ts` loads the
  bundled API.

## Knowledge

Topic docs live in [docs/knowledge/](docs/knowledge/). Start with
[liveness research](docs/knowledge/liveness-research.md) for the verification approach, threat
model, standards, and legal constraints.
