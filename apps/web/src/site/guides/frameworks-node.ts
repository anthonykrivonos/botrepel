import type { Article } from "../article-types";
import { code, diagram, guideArticle, p, ul } from "../guide-blocks";
import { ASSURANCE_SENTENCE, CREDIT_SENTENCE, PRICE_SENTENCE, TOKEN_SENTENCE } from "../guide-facts";

const nextjs = guideArticle("accounts", "bot-protection-nextjs", {
  heading: "Add human verification to a Next.js form",
  title: "Add human verification to a Next.js form",
  description: "Add human verification to a Next.js form and verify the token in the server action before you write.",
  ogAlt: "A Next.js client form posts botrepel-response to a server action, which calls siteverify before insert.",
  summary:
    "Render the BotRepel widget in a client component, then call verify() inside the server action or route handler that creates the account. The site key may use the NEXT_PUBLIC_ prefix. The secret key must not. The same widget works in a Vite React app. The server check is the same call.",
  sections: [
    {
      heading: "Install and name the keys",
      blocks: [
        p(
          "From the app directory, run npx botrepel init --domain example.com. The CLI signs you in, creates a site, and writes BOTREPEL_SECRET_KEY plus the public site key. For Next.js the public name is NEXT_PUBLIC_BOTREPEL_SITE_KEY. Add every host the widget will run on, including localhost, which the CLI adds, and a wildcard such as *.example.com when you use preview subdomains.",
        ),
        p(
          `${CREDIT_SENTENCE} The package name is botrepel. The widget is botrepel/react. The server function is verify from botrepel. Full install steps, including Better Auth and Auth.js, are in the [docs](/docs) and in [install.md](/install.md).`,
        ),
        diagram(
          "bot-protection-nextjs",
          "Browser shows a client component with the BotRepel widget. The server action reads botrepel-response and calls siteverify. The database insert runs only after success.",
          "The widget runs in the browser. siteverify runs in the server action, where the secret key is available.",
        ),
      ],
    },
    {
      heading: "Render the widget in a client component",
      blocks: [
        p(
          "The widget uses browser APIs, so the file that renders it starts with use client. A server component can import that client file. It cannot render BotRepel directly.",
        ),
        code(
          "SignupForm.tsx",
          `"use client";
import { BotRepel } from "botrepel/react";

export function SignupForm() {
  return (
    <form action={signup}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <BotRepel
        siteKey={process.env.NEXT_PUBLIC_BOTREPEL_SITE_KEY!}
        action="signup"
      />
      <button type="submit">Create account</button>
    </form>
  );
}`,
        ),
        p(
          'action="signup" must match expectedAction on the server. The component writes a hidden input named botrepel-response, so a form action receives it in FormData. Props are listed in the [docs](/docs#react): minAssurance, mode, onVerify, onError, onExpire, and reset().',
        ),
        p(
          "If you submit with fetch instead of a native form, use useBotRepel. Spread props onto the widget and send headers, which set x-botrepel-response when a token exists. After a failed response, call reset() so the next try is a new token.",
        ),
      ],
    },
    {
      heading: "Verify inside the server action",
      blocks: [
        p(
          "A server action is a public POST. Check the token inside the action. A layout guard or a hidden button does not cover a caller that posts the action directly.",
        ),
        code(
          "signup.ts",
          `"use server";
import { verify } from "botrepel";

export async function signup(formData: FormData) {
  const token = formData.get("botrepel-response");
  const result = await verify({
    secretKey: process.env.BOTREPEL_SECRET_KEY!,
    token: typeof token === "string" ? token : undefined,
    expectedAction: "signup",
    expectedHostname: "example.com",
  });
  if (!result.success) {
    return { error: "Verification failed" };
  }
  const email = String(formData.get("email") ?? "");
  // Create the account for email, then send confirmation.
  return { ok: true, email };
}`,
        ),
        p(
          `Set expectedHostname to the host you configured, such as example.com. Do not copy the request Host header into that option. A header the client can set would make any host look expected. ${TOKEN_SENTENCE} ${PRICE_SENTENCE}`,
        ),
        p(
          `${ASSURANCE_SENTENCE} Pass minAssurance: "presence" when this action must be a Human Pass or a light check. A token proves its own level and every level below it.`,
        ),
        p(
          'Route handlers use the same verify() call. Read the field from the form body, or use verifyRequest(request, { expectedAction: "signup" }) when the client sent the token in the form field or the x-botrepel-response header. Create the account only after success is true.',
        ),
      ],
    },
    {
      heading: "Auth libraries that ship with the package",
      blocks: [
        p(
          "The docs include steps that match the CLI, so this page does not fork them. Better Auth uses the botrepel/better-auth plugin and the actions signup, login, magic-link, email-otp, and password-reset. Auth.js uses withBotRepel around the route handlers, and a server-action sign-in still has to call verifyToken before signIn. Clerk's hosted components do not take a third-party token. The docs show verifying on your server before clerkClient.users.createUser. Supabase Auth's captcha setting accepts hCaptcha or Turnstile, so the docs route sign-up through your server, verify, then call Supabase.",
        ),
        ul([
          "[Better Auth](/docs#better-auth)",
          "[Auth.js](/docs#next-auth)",
          "[Clerk](/docs#clerk)",
          "[Supabase](/docs#supabase)",
        ]),
      ],
    },
    {
      heading: "The same widget in Vite or another React app",
      blocks: [
        p(
          "The CLI names VITE_BOTREPEL_SITE_KEY when it detects Vite. Render BotRepel the same way, with siteKey={import.meta.env.VITE_BOTREPEL_SITE_KEY}. There is no Next.js server action. Post the form to an endpoint you control and run verify there. An [Express](/articles/bot-protection-express) handler is one such endpoint. The secret still stays off the client bundle. Vite exposes only variables it is configured to expose. Do not prefix the secret with VITE_.",
        ),
        p(
          "A failed domain error means the page origin is not on the site. Add the dev host and the production host. A failed verification in the action should return the email to the form and ask the person to try again. Do not log the token or the secret. [What a check stores](/articles/human-verification-without-tracking) is the retention list for BotRepel's own records.",
        ),
      ],
    },
    {
      heading: "Check that both paths fail closed",
      blocks: [
        p(
          "Submit the form once with the widget and confirm the account is created. Submit again with the botrepel-response field removed and confirm the action returns an error and does not insert. Submit the same token twice and confirm the second call is timeout-or-duplicate. Those three results are the install check in [install.md](/install.md).",
        ),
      ],
    },
    {
      heading: "Preview URLs and middleware",
      blocks: [
        p(
          "A preview deployment on a new hostname fails the widget with domain until that host is allowed. A wildcard such as *.example.com covers those previews when they are truly subdomains of example.com. It does not cover a host on another parent domain. Add the parent you use, and do not add a host you do not control. The secret in the preview environment should be a test site if you can keep production charges off the preview button. The CLI can create more than one site.",
        ),
        p(
          'Next.js middleware can redirect a request. It should not be the only place that calls verify(). A server action posted directly does not need to render the page the middleware guarded. Call verify inside the action, as the sample does. If the action returns { error: "Verification failed" }, the client component should keep the email, call reset() on the widget, and show that sentence. A redirect to an error page that drops the form input makes the person type the address again for a failure they can fix by waiting for a new token.',
        ),
        p(
          "Do not cache a personalized signup POST. The token is single-use. A cached 201 would create one account and then replay success to someone else, or it would hide a later failure. The widget frame itself is served by BotRepel with its own response headers. Your page only embeds it. Preview hostnames and the production hostname are both listed on the site, or the widget returns domain and the action never sees a token.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Protect a Next.js signup form",
    steps: [
      {
        name: "Run the CLI",
        text: "npx botrepel init --domain example.com writes the secret and the public site key.",
      },
      {
        name: "Render the widget in a client component",
        text: "Use BotRepel from botrepel/react with action signup inside the form.",
      },
      {
        name: "Verify in the server action",
        text: "Call verify with the secret, the token, expectedAction signup, and your hostname. Insert the account only when success is true.",
      },
      {
        name: "Test the rejection",
        text: "Post without the field and post the same token twice. Both must fail closed.",
      },
    ],
  },
  faqs: [
    {
      question: "Can the server component render the widget?",
      answer:
        "No. The widget needs the browser. Put it in a file that starts with use client, and import that file from the server component that lays out the page.",
    },
    {
      question: "Where does the secret go in Next.js?",
      answer:
        "In BOTREPEL_SECRET_KEY, without the NEXT_PUBLIC_ prefix. The site key is the value with the NEXT_PUBLIC_ prefix. The secret stays in the server action.",
    },
  ],
  related: [
    "/articles/stop-fake-signups",
    "/articles/bot-protection-express",
    "/articles/human-verification-without-tracking",
    "/docs",
  ],
  sources: [
    { name: "BotRepel docs", href: "/docs" },
    { name: "Install guide", href: "/install.md" },
  ],
});

const express = guideArticle("accounts", "bot-protection-express", {
  heading: "Add human verification to an Express form",
  title: "Add human verification to an Express form",
  description: "Add human verification to an Express form with the iframe widget and a server-side siteverify call.",
  ogAlt: "An HTML form embeds the BotRepel iframe. Express reads the token and calls verify before creating the user.",
  summary:
    "Serve the form from Express, embed the BotRepel widget iframe, and copy the token into botrepel-response when the frame posts it. In the POST handler, call verify() with the secret key before you create the user. Parse the form body before you read the field. Do not take the expected hostname from the Host header.",
  sections: [
    {
      heading: "What you are wiring",
      blocks: [
        p(
          "Express does not ship a React tree. The [docs for a page without React](/docs#html) use an iframe pointed at BotRepel's widget and a message listener on the parent page. The server side is the same verify function Next.js uses. Install the package with npm i botrepel so the handler can call it, and keep BOTREPEL_SECRET_KEY in the environment, not in the HTML.",
        ),
        p(
          "Run npx botrepel init --domain example.com and add the origin you will put in the iframe query string. The widget will refuse a parent origin that is not on the site. [Stopping fake signups](/articles/stop-fake-signups) is the order of checks around this call: honeypot and rate limit first, then verify, then insert.",
        ),
        diagram(
          "bot-protection-express",
          "The browser loads an iframe from botrepel.com, receives a token message, and posts the form to Express. Express calls siteverify and only then inserts the user.",
          "The parent page stores the token. Express is the only place that sees the secret key.",
        ),
      ],
    },
    {
      heading: "Embed the widget",
      blocks: [
        p(
          "The iframe URL includes the public site key, the parent origin, and the action. The allow attribute is required for the camera check and for the Human Pass. Listen for messages and check event.origin before you trust the payload. The docs name the origin https://botrepel.com.",
        ),
        code(
          "form.html",
          `<form id="signup" method="post" action="/signup">
  <label>Email <input name="email" type="email" autocomplete="email" required></label>
  <iframe id="botrepel" title="Human verification"
    src="https://botrepel.com/w/br_pk_YOUR_SITE_KEY?origin=https%3A%2F%2Fexample.com&action=signup"
    allow="camera; publickey-credentials-get; publickey-credentials-create"
    style="width:300px;height:64px;border:0"></iframe>
  <input type="hidden" name="botrepel-response" value="">
  <button type="submit">Create account</button>
</form>
<script>
  const form = document.getElementById("signup");
  const frame = document.getElementById("botrepel");
  addEventListener("message", (event) => {
    if (event.origin !== "https://botrepel.com") return;
    if (event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === "botrepel:token") {
      form.elements["botrepel-response"].value = event.data.token;
    }
    if (event.data && event.data.type === "botrepel:expand") {
      frame.classList.toggle("botrepel-expanded", event.data.expanded);
    }
  });
</script>`,
        ),
        p(
          "The docs say to style .botrepel-expanded as position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: 2147483647 so the light check can use the viewport. Checking event.source against the iframe window avoids accepting a token message from some other frame on the page.",
        ),
      ],
    },
    {
      heading: "Verify in the route",
      blocks: [
        p(
          "express.urlencoded has to run before the route reads req.body. If the client posts JSON, use express.json() instead and read the same field name. verify() returns internal-error when the network call fails. Treat any success: false as a refusal.",
        ),
        code(
          "server.ts",
          `import express from "express";
import { verify } from "botrepel";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/signup", async (req, res) => {
  const token = req.body["botrepel-response"];
  const result = await verify({
    secretKey: process.env.BOTREPEL_SECRET_KEY ?? "",
    token: typeof token === "string" ? token : undefined,
    expectedAction: "signup",
    expectedHostname: "example.com",
  });
  if (!result.success) {
    res.status(403).type("text/plain").send("Verification failed");
    return;
  }
  res.status(201).send("Account created");
});`,
        ),
        p(`${TOKEN_SENTENCE} ${PRICE_SENTENCE} ${ASSURANCE_SENTENCE} ${CREDIT_SENTENCE}`),
        p(
          "Put a [rate limit](/articles/rate-limit-signup-and-login) on this route. If Express is behind a proxy, set trust proxy to the number of hops you operate before you key a limiter on req.ip. A public trust proxy setting lets the client pick the address.",
        ),
      ],
    },
    {
      heading: "Failures that look like a bug",
      blocks: [
        ul([
          "403 with missing-input-response: the hidden field was empty. The message listener did not run, the origin check rejected the message, or the person submitted before the token arrived. Disable the button until the token is set if you need to prevent that race.",
          "domain in the widget: add example.com to the site. The origin query parameter has to be the parent page's origin, URL-encoded.",
          "action-mismatch: the iframe used one action and expectedAction used another.",
          "hostname-mismatch: expectedHostname does not match the host encoded in the token. www.example.com and example.com are different hosts.",
        ]),
        p(
          'Log result["error-codes"] and the path. Do not log the token or the secret. Return the email to the form on failure so the person can retry. A second submit needs a new token. The widget mints one in auto mode after expiry. If you hold the old token in the hidden field, clear it when you receive botrepel:expired.',
        ),
      ],
    },
    {
      heading: "Frames, proxies, and more than one process",
      blocks: [
        p(
          "If the site sends a Content-Security-Policy, the iframe needs frame-src https://botrepel.com and the listener's page is still your own origin. A default frame-src 'none' makes the widget a blank box and every submit fails with an empty token. Add the expanded-frame CSS from the docs before you try a light check. Without it, the camera step opens inside a 64 pixel box and the person cannot complete it.",
        ),
        p(
          "express.urlencoded and express.json are separate. A form post uses the first. A fetch that sends JSON uses the second. Mount the parser that matches the form, or read an empty body and blame the widget. Behind nginx or a load balancer, set trust proxy to the hop count you operate before any rate limit reads req.ip. The [rate limit guide](/articles/rate-limit-signup-and-login) shows the middleware. In-memory limits reset when the process restarts and diverge when you run Node in cluster mode. Use a shared store if more than one process accepts logins.",
        ),
        p(
          "Disable the submit button until the hidden field is non-empty if users are hitting the race. Re-enable it after botrepel:expired so they are not stuck. Return 403 with the same plain sentence for a bad token and for a filled honeypot. The [honeypot guide](/articles/honeypot-fields) has the field. Keep the secret in the environment the process manager passes in, and fail the process on boot if BOTREPEL_SECRET_KEY is missing. A handler that treats a missing secret as success is a production outage you will not notice until the accounts exist. Restart the process after a secret rotation. The previous key works only for the grace period the dashboard sets, and a long-lived process that cached the old value in a module scope will start failing when that grace ends.",
        ),
        p(
          "Serve the form and the POST on the same host you put in the iframe origin. A form on www.example.com with an origin parameter of https://example.com fails the domain check even when both names reach the same Express app. Pick one canonical host, redirect the other, and use the canonical origin in the iframe. Test with the browser tools network panel: the widget frame should load, a message should arrive from https://botrepel.com, and the POST body should contain botrepel-response before you look at the 403 text. A 403 with an empty field is a front-end bug. A 403 with a token and error-codes of timeout-or-duplicate means the same token was submitted twice. Write those two cases into the runbook so the next on-call does not redeploy the server for a front-end race. Include the host name you expect in that runbook.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Protect an Express signup route",
    steps: [
      {
        name: "Create a site and install botrepel",
        text: "Run npx botrepel init --domain example.com and npm i botrepel. Keep the secret in the server environment.",
      },
      {
        name: "Embed the iframe and copy the token",
        text: "Point the iframe at /w/ with your site key, origin, and action. On botrepel:token, store event.data.token in botrepel-response after checking event.origin.",
      },
      {
        name: "Verify before insert",
        text: "In the POST handler, call verify with expectedAction signup and your hostname. Create the user only when success is true.",
      },
    ],
  },
  faqs: [
    {
      question: "Do I need the React package on an Express site?",
      answer:
        "No. The iframe embed is the documented widget for a plain HTML form. You still install botrepel on the server so verify() can call siteverify. A React page can use botrepel/react instead of the iframe.",
    },
    {
      question: "Can the browser call siteverify with the secret?",
      answer: "No. The secret stays in the Express process. The browser only holds the public site key and the token.",
    },
  ],
  related: [
    "/articles/bot-protection-nextjs",
    "/articles/stop-fake-signups",
    "/articles/rate-limit-signup-and-login",
    "/docs",
  ],
  sources: [
    { name: "BotRepel docs", href: "/docs" },
    { name: "Install guide", href: "/install.md" },
  ],
});

export const NODE_FRAMEWORK_ARTICLES: readonly Article[] = [nextjs, express];
