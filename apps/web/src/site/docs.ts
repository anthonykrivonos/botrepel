import { GUIDE_IDS, guideFor } from "../../../../packages/botrepel/src/cli/guides";
import { SITE_ORIGIN } from "../shared/constants";
import { FREE_CREDIT_MICROS, PRICE_MICROS, formatDollars } from "../shared/pricing";

/** A paragraph, a code sample, or a two-column reference table. */
export type DocBlock =
  | { readonly text: string }
  | { readonly code: string; readonly title: string }
  | { readonly rows: readonly (readonly [string, string])[] };

export interface DocSection {
  /** The URL fragment. */
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly DocBlock[];
}

/** Keep in step with packages/botrepel, packages/protocol, and lib/siteverify.ts. */
export const DOCS: readonly DocSection[] = [
  {
    id: "quickstart",
    heading: "Quickstart",
    blocks: [
      {
        text: `Paste the home page prompt into your coding agent, or run the CLI yourself. The CLI signs you in through the browser, creates a site, writes its keys to your env file, installs the botrepel package, and then prints the steps for your auth library. New accounts that sign in with GitHub or Google get ${formatDollars(FREE_CREDIT_MICROS, 0)} of usage.`,
      },
      { code: "npx botrepel init --domain example.com", title: "Terminal" },
      {
        text: "Your toolkit fits in one package, with the widget (botrepel/react), server checks (botrepel), and integrations for Better Auth, Auth.js, and Auth0. You can add it by hand with npm i botrepel.",
      },
      {
        text: "The CLI adds localhost for you, and you should add every other domain the widget runs on. Use *.example.com to cover its subdomains.",
      },
    ],
  },
  ...GUIDE_IDS.filter((id) => id !== "forms").map((id): DocSection => {
    const guide = guideFor(id, { siteKey: "process.env.NEXT_PUBLIC_BOTREPEL_SITE_KEY!" });
    return {
      id,
      heading: guide.title,
      blocks: guide.steps.flatMap((step): DocBlock[] => [
        { text: step.text },
        ...(step.code ? [{ code: step.code, title: step.file ?? guide.title }] : []),
      ]),
    };
  }),
  {
    id: "react",
    heading: "Add the widget",
    blocks: [
      {
        text: "Render the widget inside each form you protect. It adds a hidden botrepel-response field, so a native form submission carries the token.",
      },
      {
        code: `"use client";
import { BotRepel } from "botrepel/react";

export function SignupForm() {
  return (
    <form action="/api/signup" method="post">
      <input name="email" type="email" required />
      <BotRepel siteKey={process.env.NEXT_PUBLIC_BOTREPEL_SITE_KEY!} action="signup" />
      <button type="submit">Sign Up</button>
    </form>
  );
}`,
        title: "SignupForm.tsx",
      },
      {
        rows: [
          ["siteKey", "Your public key (br_pk_…), which is safe to use in the browser."],
          ["action", "What the form does, such as signup or login, using lowercase letters, numbers, - and _."],
          ["minAssurance", "Require at least invisible, presence, or liveness here, on top of the site's policy."],
          ["mode", "auto (default) checks on load, while execute waits for ref.execute()."],
          ["onVerify(token, assurance)", "Send the token with the request when you submit a form with fetch."],
          ["onError(code, message)", "The check couldn't finish, and the error codes below explain why."],
          ["onExpire()", "The token expired unused, so the widget fetches a new one if it's in auto mode."],
          ["ref", "execute(), reset() after a failed submission, and getResponse()."],
          ["inputName", "The hidden field's name, which defaults to botrepel-response."],
        ],
      },
    ],
  },
  {
    id: "verify",
    heading: "Verify on the server",
    blocks: [
      {
        text: "Verify the token before you act on the submission. Each token verifies once, within five minutes, and verifying is the only time you're charged.",
      },
      {
        code: `import { verify } from "botrepel";

const result = await verify({
  secretKey: process.env.BOTREPEL_SECRET_KEY!,
  token: formData.get("botrepel-response") as string,
  expectedAction: "signup",
  expectedHostname: "example.com",
});
if (!result.success) {
  return new Response("Verification failed", { status: 403 });
}`,
        title: "Node",
      },
      { text: "Any other language can call the REST endpoint, which takes JSON or a form body." },
      {
        code: `curl ${SITE_ORIGIN}/v1/siteverify \\
  -d secret=$BOTREPEL_SECRET_KEY \\
  -d response=$TOKEN`,
        title: "curl",
      },
      {
        code: `import os, requests

result = requests.post(
    "${SITE_ORIGIN}/v1/siteverify",
    json={"secret": os.environ["BOTREPEL_SECRET_KEY"], "response": token},
    timeout=5,
).json()
ok = result["success"] and result["action"] == "signup"`,
        title: "Python",
      },
      {
        rows: [
          ["success", "true when the token is genuine, unused, and unexpired."],
          ["assurance", "The level the token proved, either invisible, presence, or liveness."],
          ["action, hostname", "Where the check ran. Compare them with what you expect."],
          ["challenge_ts", "When the check passed (ISO 8601)."],
          [
            "pseudonym",
            "When a Human Pass was used, this is stable per person on your site and different on every site.",
          ],
          ["risk", "A value from 0 to 1, with higher values indicating more automation signals were seen."],
          ["unpaid", "Your account is out of credit, so only the invisible check ran."],
          ["error-codes", "Why it failed. Empty on success."],
        ],
      },
    ],
  },
  {
    id: "assurance",
    heading: "Assurance levels and policies",
    blocks: [
      {
        rows: [
          [
            `invisible · ${formatDollars(PRICE_MICROS.invisible, 4)}`,
            "Proof of work and browser signals run without the person needing to do anything.",
          ],
          [
            `presence · ${formatDollars(PRICE_MICROS.presence, 3)}`,
            "One tap of a Human Pass, a passkey earned by passing a light check once.",
          ],
          [
            `liveness · ${formatDollars(PRICE_MICROS.liveness, 2)}`,
            "A camera check uses a two-second color sequence followed by a head roll. Frames are discarded, while numeric scores are kept.",
          ],
        ],
      },
      {
        text: "Each site has a policy per action, set in the dashboard. A visit that looks automated is stepped up past its policy, so most people only ever see the invisible check. A token satisfies its own level and every level below it.",
      },
    ],
  },
  {
    id: "errors",
    heading: "Error codes",
    blocks: [
      { text: "The widget reports these to onError:" },
      {
        rows: [
          ["domain", "This page's domain isn't on the site's list. Add it in the dashboard or with the CLI."],
          ["no-camera", "The person can't or won't use a camera. Offer another way, such as email verification."],
          ["failed", "The checks didn't pass. The person can try again later."],
          ["network", "BotRepel couldn't be reached."],
          ["unavailable", "BotRepel is temporarily unavailable."],
        ],
      },
      { text: "siteverify returns these in error-codes:" },
      {
        rows: [
          ["missing-input-secret, invalid-input-secret", "The secret key is missing, wrong, or rotated out."],
          ["missing-input-response, invalid-input-response", "The token is missing or malformed."],
          ["timeout-or-duplicate", "The token expired or was already verified."],
          ["bad-request", "The body isn't JSON or a form."],
          ["internal-error", "Something failed on our side or on the way. Retry once."],
        ],
      },
    ],
  },
  {
    id: "html",
    heading: "Without React",
    blocks: [
      {
        text: "Embed the widget's frame and listen for its messages. Check event.origin, and put the token in your form yourself.",
      },
      {
        code: `<iframe id="botrepel" title="Human verification"
  src="${SITE_ORIGIN}/w/br_pk_YOUR_SITE_KEY?origin=https%3A%2F%2Fexample.com&action=signup"
  allow="camera; publickey-credentials-get; publickey-credentials-create"
  style="width:300px;height:64px;border:0"></iframe>
<script>
  addEventListener("message", (event) => {
    if (event.origin !== "${SITE_ORIGIN}") return;
    const frame = document.getElementById("botrepel");
    if (event.data.type === "botrepel:token") form.elements["botrepel-response"].value = event.data.token;
    // The light check needs the whole viewport while it runs.
    if (event.data.type === "botrepel:expand") frame.classList.toggle("botrepel-expanded", event.data.expanded);
  });
</script>`,
        title: "index.html",
      },
      {
        text: "Style .botrepel-expanded as position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: 2147483647.",
      },
    ],
  },
  {
    id: "security",
    heading: "Security model",
    blocks: [
      {
        text: "Treat the token as the only proof, verify it once on your server, and check its action and hostname. Never trust a value the browser reports about itself.",
      },
      {
        text: "The hostname comes from a signed ticket the widget page carries, taken from the embedding page's address. That stops someone from reusing your site key on their own site in a normal browser. It's evidence from the browser, not proof against a custom client, so the action check and single use matter as much.",
      },
      {
        text: "Keep the secret key on the server. You can rotate it from the dashboard or with npx botrepel init --rotate-secret, and the previous key keeps working for a short grace period.",
      },
    ],
  },
  {
    id: "privacy",
    heading: "Privacy for your users",
    blocks: [
      {
        text: "The light check processes camera frames, which some laws treat as biometric data. The widget explains the check and asks for consent before the camera turns on, and frames are analyzed in memory and discarded. No face template is created.",
      },
      {
        text: "Mention BotRepel in your privacy policy as a processor for bot prevention, and link our privacy policy and data processing addendum. Always offer people who can't use a camera another way through, using the no-camera error.",
      },
    ],
  },
];
