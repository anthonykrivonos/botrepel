---
name: local-dev
description: "How to run BotRepel locally and try it end to end without real OAuth apps or a deployment: the dev server and SQLite, signing in by magic link, running `botrepel init` against localhost, embedding the widget from a second origin, and the production preview. Use when asked to run the app locally, try a flow, test the CLI or widget, or when local setup misbehaves."
---

# Local development

## Run it

```sh
bun install
bun run dev        # http://localhost:3000, hot reload, migrates SQLite on start
bun run start      # the production build (run `bun run build` first), with real headers and CSP
```

- The database is SQLite at `apps/web/.data/botrepel.sqlite`. Delete it to start over. Set
  `DATABASE_PATH` for a separate one, or `DATABASE_URL` for Postgres.
- Secrets have fixed local defaults, so `.env` is optional. Production refuses to start without them.
- Use `bun run start` to check anything header-related (CSP, `frame-ancestors`, the widget's
  `Permissions-Policy`). `bun run dev` serves the widget page straight from Bun's bundler,
  without its per-site headers.

## Sign in

Without GitHub or Google credentials, the login page offers a magic link. The server prints it:

```
[email] Local email to you@example.com: Sign in to BotRepel
...
Sign in: http://localhost:3000/api/auth/magic-link/verify?token=...
```

Open that link. Every new account gets the $5 free credit.

To try OAuth, create a GitHub OAuth App with the callback
`http://localhost:3000/api/auth/callback/github` and a Google OAuth client (web application) with
the redirect URI `http://localhost:3000/api/auth/callback/google`, then set `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in `.env` and restart the
server. Browse `http://localhost:3000`, not `127.0.0.1`: the auth origin and the OAuth state
cookie are bound to `localhost`. A cancelled or failed sign-in returns to `/login?error=<code>`.
On Vercel, set the provider variables for Production only; previews run on per-deployment URLs
that providers can't be given, so they keep the magic link.

## Run the CLI against localhost

From any project folder (a fresh `create-next-app` is a good test):

```sh
BOTREPEL_API_URL=http://localhost:3000 bun ~/dev/botrepel/packages/botrepel/src/cli/bin.ts init --no-install
```

It prints a `/device` URL and code and opens the browser. Sign in, click Allow, and the CLI
writes the keys. Local credentials are stored per server origin in
`~/.config/botrepel/credentials.json`, so they never mix with production. `logout` forgets them.

## Try the widget

The widget must be embedded from an origin the site lists. `localhost` covers every local port
and `127.0.0.1`. For a quick host page, see `hostPage` in `apps/web/tests/e2e/host.ts`, or serve:

```html
<iframe src="http://localhost:3000/w/<site key>?origin=http://localhost:5173&action=signup"
        allow="camera; publickey-credentials-get; publickey-credentials-create"
        style="width:300px;height:64px;border:0"></iframe>
```

- With DevTools open, the widget still passes invisibly. Automation flags (`navigator.webdriver`,
  headless Chrome) step up, so Playwright tests either expect that or use the new headless mode
  (`channel: "chromium"`) with `--disable-blink-features=AutomationControlled`.
- Verify a token with `curl -d secret=br_sk_... -d response=br_tk_... http://localhost:3000/v1/siteverify`.
- Browsers allow the camera on `localhost` without HTTPS, which is enough for the flash check.

## Try a top-up

Payments always use Stripe test mode locally; never use live keys or real card details.

```sh
stripe listen --forward-to localhost:3000/v1/stripe/webhook   # prints a whsec_… secret
```

Put `STRIPE_SECRET_KEY=sk_test_…` and that `STRIPE_WEBHOOK_SECRET` in `.env` and restart
`bun run dev`. The dashboard then shows "Add $10/$50/$200". Pay with card `4242 4242 4242 4242`,
any future expiry, any CVC. The credit lands when the webhook arrives, usually within seconds.

## Try a Human Pass

Passkeys need a domain, so use `localhost`, not `127.0.0.1`. Run the flash check on a site whose
policy is `liveness`. After a clear pass the widget offers to create a Human Pass in a popup.
Then set the policy to `presence`: the widget offers "Use Human Pass" for one tap. The browser
tests drive this with Chrome's virtual authenticator (`apps/web/tests/e2e/human-pass.e2e.ts`).

## The home page demo

The hero runs the real widget on a demo site. Create it once (it writes both keys to `.env`), then
restart the server:

```sh
bun run demo:seed
```

Without `PUBLIC_DEMO_SITE_KEY` the demo says it's unavailable. Its server calls go through
`POST /api/demo/verify`, which only accepts same-origin requests, so set `BETTER_AUTH_URL` to the
origin you browse (e.g. `http://127.0.0.1:3000`) if it isn't `http://localhost:3000`. A Playwright
browser is usually stepped up to Human Pass or the light check: the risk signals see automation.
For production, run the seed against the production database with the domain
(`bun run demo:seed --print botrepel.com`) and set both printed keys in the Vercel project.

## Tests

See the testing skill. `bun run test:e2e` builds, starts the preview on port 3100 with its own
`apps/web/.data/e2e.sqlite`, and seeds sites through `apps/web/tests/e2e/seed-site.ts`.
