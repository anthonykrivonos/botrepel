import type { Article } from "../article-types";
import { code, diagram, guideArticle, p, ul } from "../guide-blocks";
import { ASSURANCE_SENTENCE, CREDIT_SENTENCE, PRICE_SENTENCE, TOKEN_SENTENCE } from "../guide-facts";

const fakeSignups = guideArticle("accounts", "stop-fake-signups", {
  heading: "How to stop fake signups",
  title: "Stop fake signups with a server-side check",
  description: "Stop fake signups by verifying a human verification token on the server before the account is created.",
  ogAlt: "Signup flow: honeypot and rate limit, then siteverify, then the account row is inserted.",
  summary:
    "Create the account only after your server accepts a human verification token for the signup action. Add a rate limit and a honeypot in front of that call so obvious scripts never spend a verification. Confirm the email before the account can post or buy. A client-side flag that says the widget passed is not a check.",
  sections: [
    {
      heading: "Reject the request before the row exists",
      blocks: [
        p(
          "A fake signup is a successful create. The fix is to refuse the create. Delete-the-account-later jobs still leave a row, a welcome email, and a quota hit. Do the checks in the same request that would insert the user, and insert only when they pass.",
        ),
        p(
          "Order the cheap checks first. A missing required field, a honeypot that was filled, and a rate limit that is already exhausted can all return before you call BotRepel. Then call siteverify. Then insert. If the insert fails, do not verify a second token for the same submit. The person can retry, and the widget can mint a new token.",
        ),
        diagram(
          "stop-fake-signups",
          "Decision flow for a signup. Invalid fields and a filled honeypot return early. A rate limit returns 429. siteverify must succeed before the database insert.",
          "The account row is the last step. siteverify is the last check that can still say no.",
        ),
      ],
    },
    {
      heading: "Put the widget on the form and verify on the server",
      blocks: [
        p(
          "The React widget is documented in [Add the widget](/docs#react). It adds a hidden field named botrepel-response. A normal form post includes that field. If you submit with fetch, send the token from onVerify, or send the header x-botrepel-response. The server package reads either one.",
        ),
        code(
          "server.ts",
          `import { verify } from "botrepel";

export async function createAccount(formData: FormData) {
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
  // Insert the account here, then send the confirmation email.
}`,
        ),
        p(
          `Use the same action string on the widget and in expectedAction. ${TOKEN_SENTENCE} ${PRICE_SENTENCE} ${ASSURANCE_SENTENCE} ${CREDIT_SENTENCE}`,
        ),
        p(
          "Keep BOTREPEL_SECRET_KEY on the server. The site key, which starts with br_pk_, is the value that ships in the page. The docs list the error codes. missing-input-response means the field was empty. timeout-or-duplicate means the token was old or already used. Show the person a way to try again, and call reset() on the widget after a rejected submit so the next attempt gets a new token.",
        ),
        p(
          "Framework-specific wiring is in the guides for [Next.js](/articles/bot-protection-nextjs), [Express](/articles/bot-protection-express), [Django](/articles/bot-protection-django), [Rails](/articles/bot-protection-rails), and [WordPress](/articles/bot-protection-wordpress).",
        ),
      ],
    },
    {
      heading: "Add the checks that do not replace verification",
      blocks: [
        p(
          "A [honeypot](/articles/honeypot-fields) is a field people leave empty and simple bots fill in. It catches the simplest posters. A browser automation stack skips hidden fields, so the honeypot is not the verification step.",
        ),
        p(
          "A [rate limit](/articles/rate-limit-signup-and-login) caps creates per IP and, once you have an email, per email. Shared NATs need a ceiling high enough for a household. The limit's job is to cap damage when the other checks fail open, for example when your call to siteverify times out and you choose to retry.",
        ),
        p(
          "Confirm the email address before the account can act. A script can still receive mail at a domain it owns, so confirmation is not human verification. It does stop throwaway typos and it gives you a working address to lock or notify. Do not tell the visitor whether an email is already registered if that would let a caller enumerate accounts. Use the same response for a new address and an existing one, and send the detailed message only to the mailbox.",
        ),
      ],
    },
    {
      heading: "Choose the assurance the action requires",
      blocks: [
        p(
          "Each site has a policy per action in the dashboard. A visit that looks automated is stepped up past that policy. Most people stay on the invisible check. Set signup's minimum to invisible when the cost of a fake account is low and you confirm email. Require presence, the Human Pass, when one person creating many accounts is the problem you are measuring. Require liveness only for the actions where a camera check is justified, and keep the no-camera path.",
        ),
        p(
          "The Human Pass is a passkey created after one light check. Each site receives a different pseudonym. That pseudonym lets you see repeat passes on your site. It is not a government identity, and it is not the person's email. Do not label it as identity verification.",
        ),
      ],
    },
    {
      heading: "When the check fails",
      blocks: [
        p(
          "Return the form with the person's input still in it, apart from the password, which they should type again. Say that verification failed and that they can retry. Do not joke about the failure, and do not imply they are less human.",
        ),
        p(
          "If the widget reports no-camera, offer the fallback you actually operate, such as a mailed link, and say what that fallback does not prove. If your account is out of credit, siteverify can return unpaid and only the invisible check will have run. Top up in the dashboard before you depend on a higher assurance.",
        ),
        ul([
          "domain: the page's host is not on the site's domain list. Add it in the dashboard or with the CLI.",
          "network or unavailable: the browser could not reach BotRepel. Retry once.",
          "internal-error from siteverify: retry the verification once. Do not create the account on an error you did not get a success for.",
        ]),
      ],
    },
    {
      heading: "After the account exists",
      blocks: [
        p(
          "A passed token means the check for that action succeeded once. It does not mean the email is a person you want on the site, and it does not mean the password is unused elsewhere. Confirm the address before the account can post, buy, or invite other people. Hold new accounts out of public listings until that mail is confirmed. A script that owns a mailbox still gets through confirmation. The token is what raised the cost of getting the mailbox created in the first place.",
        ),
        p(
          "Watch creates per hour, not a vibe about the user table. If the rate of successful verifications jumps and the addresses share a pattern, lower the IP rate limit or raise the signup assurance, and say which change you made. Do not buy a secret list of bad emails and treat it as part of BotRepel. This product does not ship one. A denylist you operate is your data, with your appeal path.",
        ),
        p(
          "Support needs a sentence they can send: verification failed, try again, or use the mailed link if the camera is unavailable. They do not need the token. They do need the time and the error code. That is enough to see a domain mismatch, a duplicate token, or an empty field. The [Next.js](/articles/bot-protection-nextjs) and [WordPress](/articles/bot-protection-wordpress) guides show where that code is produced.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Check a signup before the account exists",
    steps: [
      {
        name: "Render the widget with action signup",
        text: "Add the BotRepel widget inside the signup form so the post includes botrepel-response.",
      },
      {
        name: "Reject cheap failures first",
        text: "Return early for a filled honeypot, a failed field check, or a rate limit that is already exhausted.",
      },
      {
        name: "Call siteverify",
        text: "Send the secret key and the token. Require success, the signup action, and your hostname.",
      },
      {
        name: "Insert the account",
        text: "Create the row only after verification succeeds, then send the confirmation email.",
      },
      {
        name: "Reset the widget after a failure",
        text: "Keep the form input, ask the person to try again, and mint a new token for the next submit.",
      },
    ],
  },
  faqs: [
    {
      question: "Is a hidden field enough to stop fake signups?",
      answer:
        "A honeypot stops some simple scripts. Browsers that run JavaScript and skip empty hidden fields walk past it. Verify a token on the server as well.",
    },
    {
      question: "When is the verification charged?",
      answer:
        "BotRepel charges when siteverify succeeds. Minting the token in the widget is not the charge. A failed verification is not a successful one.",
    },
    {
      question: "Does email confirmation prove a person?",
      answer:
        "It proves the address can receive mail. A script can own a mailbox. Use confirmation in addition to human verification, not as a substitute.",
    },
  ],
  related: [
    "/articles/honeypot-fields",
    "/articles/rate-limit-signup-and-login",
    "/articles/bot-protection-nextjs",
    "/articles/stop-bots-on-signup-forms",
    "/docs",
  ],
  sources: [
    { name: "BotRepel docs", href: "/docs" },
    { name: "BotRepel about page", href: "/about" },
    {
      name: "Credential Stuffing Prevention Cheat Sheet, OWASP",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html",
    },
  ],
});

const honeypot = guideArticle("accounts", "honeypot-fields", {
  heading: "Honeypot fields for signup forms",
  title: "How honeypot fields stop signup form spam",
  description: "Build a honeypot field for a signup form, and add human verification where the honeypot fails.",
  ogAlt:
    "A person leaves the honeypot empty. A simple bot fills it. A browser bot skips it and still faces siteverify.",
  summary:
    "Add one extra field that people do not see and do not fill. If the field comes back with a value, reject the signup. Hide it from assistive tech and from the tab order so a person is not stuck in it. Treat a pass as weak evidence: many bots skip hidden inputs. Still verify a human token on the server before you create the account.",
  sections: [
    {
      heading: "What the field is for",
      blocks: [
        p(
          "A honeypot is a decoy input. The label and the autocomplete hints are written so a naive form filler types a URL or a company name. The CSS or the HTML hides the input from the layout. Your server's rule is small: a non-empty value means reject.",
        ),
        p(
          "The technique is old because the cheapest bots still post every input they find in the HTML. It costs nothing at request time and it needs no third-party call. It also fails in predictable ways, which the rest of this page lists. Use it as the first refuse, then continue with [human verification](/articles/stop-fake-signups).",
        ),
        diagram(
          "honeypot-fields",
          "Three paths. A person submits an empty honeypot and continues to siteverify. A simple bot fills the honeypot and is rejected. A browser automation stack leaves it empty and is checked by siteverify.",
          "An empty honeypot is not a verdict. It only means this client did not fill the decoy.",
        ),
      ],
    },
    {
      heading: "Build one that people do not land in",
      blocks: [
        p(
          "Give the field a name a bot expects, such as company_website. Do not name it honeypot or hidden. Leave the value empty. Set autocomplete to off, tabindex to -1, and aria-hidden to true. Do not rely on display:none alone if you can also keep it out of the accessibility tree. A screen reader user who is asked for a website they cannot see will either fail the form or fill it and get rejected.",
        ),
        code(
          "signup.html",
          `<form method="post" action="/signup">
  <label>Email <input name="email" type="email" autocomplete="email" required></label>
  <div aria-hidden="true" style="position:absolute;left:-10000px;height:1px;width:1px;overflow:hidden">
    <label>Company website <input name="company_website" tabindex="-1" autocomplete="off"></label>
  </div>
  <input type="hidden" name="botrepel-response" value="">
  <button type="submit">Create account</button>
</form>`,
        ),
        p(
          "The BotRepel field in that snippet is not the honeypot. The widget or your script fills botrepel-response. company_website stays empty for a person. Reject when company_website is non-empty, even if the token would have passed. Check the honeypot before you call siteverify so a noisy bot does not spend a verification.",
        ),
        code(
          "check.ts",
          `const decoy = formData.get("company_website");
if (typeof decoy === "string" && decoy.trim() !== "") {
  return new Response("Verification failed", { status: 400 });
}`,
        ),
        p(
          "Use the same failure response you use for a bad token. A special copy that says the honeypot tripped teaches the bot which field to skip next time.",
        ),
      ],
    },
    {
      heading: "Where it fails",
      blocks: [
        ul([
          "Browser automation fills only the fields it was told about, or only visible fields. An empty honeypot is the common result.",
          "Password managers and browser autofill sometimes fill a field because the name looked like a website or a company. Off-screen is safer than a field that is merely the same color as the page, and autocomplete=off reduces the chance. It does not eliminate it. If real signups fail, log the field name that tripped, fix the hint, and do not keep rejecting those people.",
          "A required attribute on the honeypot makes a person fail the form. Leave it optional.",
          "CSS that only uses display:none is what many fillers already know to skip. The server rule is the same either way. The hiding method mostly affects whether a person can reach the field.",
          "Time-to-submit checks, such as rejecting a post that arrives in under two seconds, catch some scripts and also catch autofill on a short form. If you add one, make the window short and the error retryable.",
        ]),
        p(
          "None of these failures are a reason to skip the server token check. They are the reason the honeypot cannot be the only check.",
        ),
      ],
    },
    {
      heading: "What to pair it with",
      blocks: [
        p(
          "Rate-limit the signup route, confirm the email before the account can act, and verify the BotRepel token with the signup action. The [rate limit](/articles/rate-limit-signup-and-login) and [fake signup](/articles/stop-fake-signups) guides have the order. A honeypot does not satisfy a site policy for assurance, and it does not produce a pseudonym or a risk score.",
        ),
      ],
    },
    {
      heading: "Test it with a person and with a keyboard",
      blocks: [
        p(
          "Tab through the form. The decoy should not take focus. A screen reader should not announce it. If either happens, the hiding failed even when the server rule is correct. Submit once as yourself and confirm the account is created. Submit again with company_website set to https://example.com and confirm the response matches a normal verification failure and that siteverify was not called. You can see the second part in the server log: no outbound request, and no charge.",
        ),
        p(
          "Then run a browser automation test that fills only email and password and clicks the button. That test should reach siteverify and fail if you withhold the token. If it is rejected for the honeypot, the tool filled the decoy and you have learned about that tool, not about the people who will sign up. Keep one honeypot. A second decoy doubles the chance a password manager fills something, and it does not catch the automation that already skips both.",
        ),
        p(
          "Watch real failures for a week before you add a time rule. If you do add one, start with a very short floor, such as rejecting a post that arrives in under one second, and make the error tell the person to wait and submit again. Autofill on a short form can beat a two-second rule. Record the field that tripped, not the person's email in the same breath as a secret. The decoy value can be logged. The password cannot. If a real signup fails the decoy more than rarely, remove the field and rely on the token. A honeypot that rejects customers is more expensive than the bots it caught.",
        ),
        p(
          "Place the decoy inside the same form element as the email field. A field that sits outside the form is never submitted, so it never trips, and you will think the technique works because the log stays quiet. Give the label a real word, Company website, so a naive filler has something to type. Do not add a placeholder that says leave this blank. The people who need that instruction are the people who should not see the field, and the bots that read placeholders will obey it. Check the rendered HTML in production. A template preview can miss a form plugin that renames inputs or drops aria-hidden when it rebuilds the markup. View source on the live signup URL before you call the field done. A staging theme and the production theme are often different files. Compare the live markup after each theme deploy. Ask someone who uses a keyboard to tab the form before you ship the field.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Add a honeypot without blocking people",
    steps: [
      {
        name: "Add an optional decoy field",
        text: "Name it like a real field, such as company_website. Leave it empty, optional, and out of the tab order.",
      },
      {
        name: "Hide it from assistive technology",
        text: "Keep it off-screen and set aria-hidden. Do not use a required attribute on the decoy.",
      },
      {
        name: "Reject a non-empty value first",
        text: "If the decoy has a value, return the same error you use for a failed verification, before calling siteverify.",
      },
      {
        name: "Verify the human token",
        text: "When the decoy is empty, still require a successful siteverify for the signup action before creating the account.",
      },
    ],
  },
  faqs: [
    {
      question: "Should the honeypot use type=hidden?",
      answer:
        "Some fillers skip inputs of type hidden and fill text inputs instead. An off-screen text field catches more of those fillers. People still need to be kept out of it with tabindex and aria-hidden.",
    },
    {
      question: "Can I count an empty honeypot as a passed captcha?",
      answer:
        "No. An empty decoy means that field was not filled. Verify a BotRepel token on the server before you create the account.",
    },
  ],
  related: ["/articles/stop-fake-signups", "/articles/rate-limit-signup-and-login", "/articles/captcha-alternatives"],
  sources: [
    { name: "BotRepel docs", href: "/docs" },
    {
      name: "Credential Stuffing Prevention Cheat Sheet, OWASP",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html",
    },
  ],
});

const rateLimit = guideArticle("accounts", "rate-limit-signup-and-login", {
  heading: "Rate limit signup and login endpoints",
  title: "Rate limit signup and login form endpoints",
  description: "Rate-limit signup and login endpoints, then require human verification before the account changes.",
  ogAlt: "A login endpoint counts attempts per IP and per account, then requires a verified token.",
  summary:
    "Count signup and login attempts in a short window and in a longer window, keyed by the client IP and by the account name. Return 429 when the count is exhausted, and do not run the password check or the account insert. A rate limit slows a single source. It does not stop a low, steady attack from many IPs. Keep human verification on the form as well.",
  sections: [
    {
      heading: "Count the attempt, then do the work",
      blocks: [
        p(
          "A limiter stores a counter for a key. The key for anonymous traffic is the client IP. The key for a login is also the account identifier, so one password list aimed at one email is capped even when each try comes from a new proxy. Check the counter before you hash a password or call siteverify. A request you were going to reject should be cheap.",
        ),
        p(
          "Use two windows. A short one, such as 5 to 10 attempts in 15 minutes, stops a burst. A longer one, such as a few dozen in a day for a single account, stops a trickle. OWASP's [credential stuffing cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html) says a single volume limit is not enough, because toolkits spread attempts across proxies and keep each IP under a naive ceiling. The numbers here are starting points. Read your logs and raise the IP ceiling if a carrier-grade NAT is locking out real users.",
        ),
        diagram(
          "rate-limit-signup-and-login",
          "Login requests increment an IP bucket and an account bucket. Over the limit, the server returns 429. Under the limit, siteverify runs, then the password check.",
          "Both buckets have to pass. The password is checked only after the counters and the human verification token.",
        ),
      ],
    },
    {
      heading: "Express",
      blocks: [
        p(
          "express-rate-limit stores the counter in memory by default, which means each server process has its own tally. Use a shared store such as Redis when you run more than one process. Behind a reverse proxy, enable trust proxy only for hops you operate, or the limit keys off the proxy and everyone shares one bucket.",
        ),
        code(
          "server.ts",
          `import express from "express";
import { rateLimit } from "express-rate-limit";
import { verify } from "botrepel";

const app = express();
const loginIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/login", express.urlencoded({ extended: false }), loginIp, async (req, res) => {
  const token = req.body["botrepel-response"];
  const result = await verify({
    secretKey: process.env.BOTREPEL_SECRET_KEY ?? "",
    token: typeof token === "string" ? token : undefined,
    expectedAction: "login",
    expectedHostname: "example.com",
  });
  if (!result.success) {
    res.status(403).send("Verification failed");
    return;
  }
  // Check the password here. Use the same error for an unknown email and a wrong password.
  res.status(401).send("Email or password is wrong");
});`,
        ),
        p(
          "The package's options are documented in its [readme](https://github.com/express-rate-limit/express-rate-limit). limit is the count inside windowMs. standardHeaders adds RateLimit response headers so a well-behaved client can back off. Add a second counter keyed by the email in the same handler, in Redis or a similar store, and return 429 when that account bucket is exhausted. The IP middleware does not see the account name.",
        ),
      ],
    },
    {
      heading: "A shared counter in Django or Rails",
      blocks: [
        p(
          "Django's cache framework can store the counter when the backend supports atomic increment. The [low-level cache API](https://docs.djangoproject.com/en/stable/topics/cache/) documents cache.add and cache.incr. LocMemCache is per process. Use Redis or Memcached in production so every app server shares the count.",
        ),
        code(
          "views.py",
          `from django.core.cache import cache
from django.http import HttpResponse

def over_limit(key: str, limit: int, window: int) -> bool:
    if cache.add(key, 1, timeout=window):
        return False
    try:
        return cache.incr(key) > limit
    except ValueError:
        cache.set(key, 1, timeout=window)
        return False

def login(request):
    ip = request.META.get("REMOTE_ADDR", "")
    if over_limit(f"login-ip:{ip}", 20, 15 * 60):
        return HttpResponse("Too many attempts. Try again later.", status=429)
    # Verify the BotRepel token, then check the password.`,
        ),
        p(
          "In Rails, [rack-attack](https://github.com/rack/rack-attack) throttles in the middleware, before the controller. The block returns the key to count, or nil when the request should not be counted.",
        ),
        code(
          "rack_attack.rb",
          `Rack::Attack.throttle("logins/ip", limit: 20, period: 15.minutes) do |req|
  req.ip if req.post? && req.path == "/login"
end`,
        ),
        p(
          "Put the app behind a proxy that sets a trustworthy client IP, and configure Rails trusted proxies to match. A forged X-Forwarded-For header must not choose the bucket.",
        ),
      ],
    },
    {
      heading: "Signup limits differ from login limits",
      blocks: [
        p(
          "Signup can be stricter per IP, because a person rarely creates ten accounts in a quarter hour. Login has to allow a household, a school, or a mobile network. Key login failures by account as well as by IP. Key signup by IP, and by a normalized email if you want to slow one address that is retried with small changes.",
        ),
        p(
          "Return the same login error for an unknown email and a wrong password. A rate limit that only fires after you reveal that the account exists will be used as an oracle. Count the attempt either way.",
        ),
        p(
          "When the limiter trips, say how long the wait is if you know it, and do not clear the email field. Do not ask the person to solve an unrelated puzzle as the only recovery. The [captcha alternatives](/articles/captcha-alternatives) page covers that problem. A BotRepel token is still required on the attempt you do accept. The limiter and the token answer different questions: how many tries, and whether this try carried a fresh verification.",
        ),
      ],
    },
    {
      heading: "Fail closed on the write, fail open only on purpose",
      blocks: [
        p(
          "If Redis is down, decide in advance. Failing open means every attempt proceeds to siteverify and the password check, which is what an attacker wants during the outage. Failing closed means nobody can log in until the counter store returns. Many teams fail closed on signup and fail open on login, and they page a person either way. Write the choice down next to the limiter.",
        ),
        p(
          `${TOKEN_SENTENCE} Do not call siteverify once per password guess after the limiter should have stopped the request. ${PRICE_SENTENCE}`,
        ),
      ],
    },
    {
      heading: "What a locked-out person should see",
      blocks: [
        p(
          "Return 429 with a short sentence and, when you know it, a Retry-After value in seconds. Keep the email field filled. Do not clear the form and do not ask the person to start over on a different page. Support staff need a way to see which bucket fired, IP or account, without reading the password. An account bucket lock should not look like a site outage. An IP bucket lock at a school or a carrier will hit people who never tried to log in. If that shows up in tickets, raise the IP ceiling and keep the account ceiling.",
        ),
        p(
          "A worked example: twenty attempts in fifteen minutes per IP, and five failures in fifteen minutes per email. A household on one address can still mistype. A list aimed at one email stops on the fifth failure even when each try uses a new proxy. A list aimed at many emails from one server stops on the twentieth IP hit. Neither number is magic. Write the numbers you deployed next to the date you deployed them, and change them from the 429 rate and the support tickets, not from a blog post.",
        ),
        p(
          "The limiter is in front of human verification so a loop does not mint a paid check it will not use. The attempts you do accept still need a token. A 200 from the limiter is not a login. The [credential stuffing](/articles/credential-stuffing) guide is the next layer when the password on those attempts is often correct. Store the deployed ceilings in the same file as the middleware so a review can see the number without reading a ticket.",
        ),
      ],
    },
  ],
  howTo: {
    name: "Add limits to signup and login",
    steps: [
      {
        name: "Key a counter by client IP",
        text: "Use the real client IP from your proxy, not an untrusted forwarded header.",
      },
      {
        name: "Key login by account as well",
        text: "Cap attempts against one email even when each request comes from a new address.",
      },
      {
        name: "Return 429 before the password check",
        text: "Stop the request when either counter is exhausted. Use the same login error for unknown users and bad passwords.",
      },
      {
        name: "Verify the human token on attempts you accept",
        text: "Call siteverify for the login or signup action before creating a session or an account.",
      },
    ],
  },
  faqs: [
    {
      question: "Is 20 login attempts per 15 minutes the right cap?",
      answer:
        "Use 20 attempts per 15 minutes as a starting point for one IP. Change it from your logs. Add a separate, tighter cap on each account name.",
    },
    {
      question: "Does a rate limit replace human verification?",
      answer:
        "No. A limiter counts requests. A token from the widget is checked by siteverify and says whether this request passed the human check. Use both.",
    },
  ],
  related: [
    "/articles/credential-stuffing",
    "/articles/stop-fake-signups",
    "/articles/bot-protection-express",
    "/articles/honeypot-fields",
  ],
  sources: [
    {
      name: "express-rate-limit",
      href: "https://github.com/express-rate-limit/express-rate-limit",
    },
    {
      name: "Django cache API",
      href: "https://docs.djangoproject.com/en/stable/topics/cache/",
    },
    { name: "rack-attack", href: "https://github.com/rack/rack-attack" },
    {
      name: "Credential Stuffing Prevention Cheat Sheet, OWASP",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html",
    },
    { name: "BotRepel docs", href: "/docs" },
  ],
});

const stuffing = guideArticle("accounts", "credential-stuffing", {
  heading: "Defend a login form against credential stuffing",
  title: "Defend a login form from credential stuffing",
  description: "See what credential stuffing is, and add rate limits plus human verification on the login form.",
  ogAlt:
    "Leaked email and password pairs are tried on a login form. The server rate-limits, verifies a token, and can require a second factor.",
  summary:
    "Credential stuffing is trying email and password pairs stolen from another site, hoping they were reused. Password spraying is trying a few common passwords against many accounts. Cap both with per-account and per-IP limits, require a fresh human verification token on the login post, and offer a second factor that is not another password. A client-side browser check will be bypassed by the toolkits that already drive real browsers.",
  sections: [
    {
      heading: "Name the attack before you pick a control",
      blocks: [
        p(
          "OWASP's [credential stuffing cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html) separates three patterns. Brute force tries many passwords against one account. Credential stuffing tries known pairs from a breach of some other service. Password spraying tries one or a few weak passwords against many accounts. The login form sees all three as a series of posts. The counters and the messages differ.",
        ),
        p(
          "Stuffing works when people reuse passwords. You will not see the other site's breach in your logs. You see successful logins from new networks, or a long series of failures that stay just under a simple IP limit. Assume reuse happens. Do not wait for a named breach to add the controls.",
        ),
        diagram(
          "credential-stuffing",
          "A list of leaked pairs is submitted to the login form from many IPs. Each request hits an account rate limit and siteverify. A second factor stands behind a correct password.",
          "The password can be correct and still be stolen. A second factor and a verification token sit on that path.",
        ),
      ],
    },
    {
      heading: "What OWASP treats as the strong control",
      blocks: [
        p(
          "The cheat sheet describes multi-factor authentication as the defense that stops most password replay, and it says the other controls are weaker on their own. It also says a second password or a security question is another memory test, not a second factor. Prefer a factor the person possesses or a passkey. BotRepel's Human Pass is a passkey that proves a prior light check on your verification widget. It is not a replacement for your account's own second factor unless you have designed the login that way and said so.",
        ),
        p(
          "The same page says CAPTCHA puzzles slow automation and are broken often enough that they cannot be the only defense. It suggests showing them when a login looks risky, not on every happy path. BotRepel's invisible check is a proof-of-work puzzle plus browser signals, and risk can step the same visit up to a Human Pass or a light check. That is a layered check with a server-side token. It is still one layer. Keep the account second factor for a correct password from a new device if the account can spend money or read other people's data.",
        ),
      ],
    },
    {
      heading: "Limits, tokens, and leaked-password checks",
      blocks: [
        p(
          "Apply the counters in the [rate limit guide](/articles/rate-limit-signup-and-login): a burst limit per IP, a tighter limit per account, and the same error text for unknown users and bad passwords. Return 429 before you do expensive work.",
        ),
        p(
          `Require a BotRepel token with action login on the post. ${TOKEN_SENTENCE} Set expectedAction to login so a signup token cannot be replayed here. ${ASSURANCE_SENTENCE}`,
        ),
        code(
          "login.ts",
          `const result = await verify({
  secretKey: process.env.BOTREPEL_SECRET_KEY!,
  token: typeof token === "string" ? token : undefined,
  expectedAction: "login",
  expectedHostname: "example.com",
  minAssurance: "invisible",
});
if (!result.success) {
  return new Response("Verification failed", { status: 403 });
}`,
        ),
        p(
          "OWASP also points at breached-password checks, and names the Pwned Passwords API as one implementation you can call or host yourself. BotRepel does not include that check. If you add it, hash the password the way that API requires and refuse known passwords at registration and at password change. Checking only at login, after a correct password, tells you the account is already using a leaked password. Notify the person and require a change. Do not put the password in your logs while you do this.",
        ),
      ],
    },
    {
      heading: "Signals that should raise the check, not lock the account forever",
      blocks: [
        p(
          "OWASP lists reasons to ask for a second factor: a new device, an unusual location, an IP that has tried many accounts, or a login that looks scripted. It also says IP bans should be temporary, because attackers move and because a ban hits everyone behind that address. A hosting-provider IP can be a reason to require the token's higher assurance. It is a blunt reason to close the account.",
        ),
        p(
          "Device and connection fingerprints, including user agent, header order, and JA3-style TLS fingerprints, are described on the same cheat sheet as clues the client can still forge. The [headless browser](/articles/detect-headless-browsers) guide covers the browser half. Store a short history of successful login networks if you want to show the person their last login. Offer a way to revoke other sessions.",
        ),
      ],
    },
    {
      heading: "Tell the person what happened",
      blocks: [
        p(
          "Notify on a successful password plus a failed second factor. A single wrong password does not need an email, or the mailbox fills up during an attack and the real warnings get ignored. OWASP notes that the person's email account may be caught in the same reuse problem, so a reset link is not a guaranteed private channel. Keep a second path, such as a passkey they already enrolled or a support process you actually staff.",
        ),
        p(
          "On the form, say that verification failed or that the account is temporarily locked, and say when they can retry. Do not say you have decided they are a bot. Link the recovery you have. Prices and token lifetime for the verification layer are on the [about page](/about).",
        ),
      ],
    },
    {
      heading: "After a password that was correct and still suspicious",
      blocks: [
        p(
          "A successful password from a new network is the case stuffing is built for. Do not wait for a second identical login to act. Require the second factor you already offer, or the Human Pass if that is the step-up you configured for login, before you issue a session that can spend money or read private data. If the second factor fails, keep the session logged out and mail the account. One wrong password does not deserve that mail. A correct password plus a failed factor does.",
        ),
        p(
          "Give the person a list of active sessions and a control that revokes the others. Show the time of the previous successful login if you stored it. Offer a password change that checks a breach list you operate yourself, such as the Pwned Passwords range API that OWASP names. BotRepel will not do that lookup. Rotate the password, revoke sessions, and leave the verification token out of the incident notes.",
        ),
        p(
          "If many accounts succeed from one new network in an hour, treat that as an incident even when each account stayed under its own limit. The per-account counter did its job. The pattern is across accounts. Temporarily require a higher assurance on login, using the site policy, and say when you will turn it back down. A permanent worldwide step-up is a product change, not an incident response.",
        ),
      ],
    },
  ],
  faqs: [
    {
      question: "How is credential stuffing different from brute force?",
      answer:
        "Brute force tries many passwords on one account. Credential stuffing tries pairs that were already stolen from somewhere else. Password spraying tries a few common passwords on many accounts.",
    },
    {
      question: "Will a captcha stop credential stuffing?",
      answer:
        "OWASP says puzzles slow automated tries and are often broken, so they are not a complete defense. Use a server-verified token, rate limits, and a real second factor on the account.",
    },
    {
      question: "Does BotRepel check passwords against breach lists?",
      answer:
        "No. siteverify checks the widget token. A breached-password lookup, such as Pwned Passwords, is a separate check you would add in your own registration and password-change code.",
    },
  ],
  related: [
    "/articles/rate-limit-signup-and-login",
    "/articles/detect-headless-browsers",
    "/articles/stop-fake-signups",
    "/articles/bot-protection-nextjs",
  ],
  sources: [
    {
      name: "Credential Stuffing Prevention Cheat Sheet, OWASP",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html",
    },
    { name: "BotRepel docs", href: "/docs" },
    { name: "BotRepel about page", href: "/about" },
  ],
});

export const ACCOUNT_ARTICLES: readonly Article[] = [fakeSignups, honeypot, rateLimit, stuffing];
