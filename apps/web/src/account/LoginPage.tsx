import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authClient, errorPath, returnPath } from "./client";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { rpc } from "../utils/rpc";

type Provider = "github" | "google";

/** The providers' own wording, which DESIGN.md exempts from title case. */
const PROVIDER_LABELS: Readonly<Record<Provider, string>> = {
  github: "Continue with GitHub",
  google: "Continue with Google",
};

const STALE_SIGN_IN = "That sign-in took too long or was opened in another browser. Try again.";
const SIGN_IN_FAILED = "Sign-in failed. Try again.";

/** Better Auth's `?error=` codes in our words; anything else gets the generic line. */
const ERROR_COPY: Readonly<Record<string, string>> = {
  access_denied: "Sign-in was cancelled.",
  state_mismatch: STALE_SIGN_IN,
  state_not_found: STALE_SIGN_IN,
  INVALID_TOKEN: "That link has expired. Request a new one.",
  email_not_found: "That account has no email address. Add one with the provider, then try again.",
  email_not_verified: "Verify your email address with the provider, then try again.",
  account_not_linked: "An account with that email already exists. Sign in the way you did before.",
  unable_to_link_account: "An account with that email already exists. Sign in the way you did before.",
  account_already_linked_to_different_user:
    "That GitHub or Google account already belongs to another BotRepel account.",
};

export function LoginPage(): React.JSX.Element {
  const methods = useQuery(rpc.signInMethods.queryOptions());
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<Provider | "email" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  // A failed OAuth or magic-link sign-in returns here as /login?error=<code>. Only the code is read; the
  // description Better Auth forwards is the provider's raw text.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) {
      setMessage({ tone: "danger", text: ERROR_COPY[code] ?? SIGN_IN_FAILED });
    }
  }, []);

  const social = async (provider: Provider): Promise<void> => {
    setPending(provider);
    const { error } = await authClient().signIn.social({
      provider,
      callbackURL: returnPath(),
      errorCallbackURL: errorPath(),
    });
    if (error) {
      setPending(null);
      setMessage({ tone: "danger", text: error.message ?? SIGN_IN_FAILED });
    }
  };

  const sendLink = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setPending("email");
    const { error } = await authClient().signIn.magicLink({
      email,
      callbackURL: returnPath(),
      errorCallbackURL: errorPath(),
    });
    setPending(null);
    setMessage(
      error
        ? { tone: "danger", text: error.message ?? "Couldn't send the link. Try again." }
        : { tone: "ok", text: `Check ${email} for a sign-in link.` },
    );
  };

  const providers = (["github", "google"] as const).filter((provider) => methods.data?.[provider]);
  // One primary button per view: the first provider, or the email link when no provider is configured.
  const primary: Provider | "email" = providers[0] ?? "email";

  return (
    <main className="flex min-h-dvh items-center justify-center glow-info-wash px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <a href="/" aria-label="BotRepel home">
          <Logo className="text-lg" />
        </a>
        <Card className="flex w-full flex-col gap-4">
          <h1 className="text-center text-xl">Sign in</h1>
          {providers.length > 0 ? (
            <p className="-mt-2 text-center text-sm text-fg-muted">
              New accounts that sign in with GitHub or Google receive $5 of usage.
            </p>
          ) : null}
          {providers.map((provider) => (
            <Button
              key={provider}
              variant={provider === primary ? "primary" : "secondary"}
              disabled={pending !== null}
              onClick={() => void social(provider)}
            >
              {PROVIDER_LABELS[provider]}
            </Button>
          ))}
          {methods.data?.magicLink && (
            <form onSubmit={(event) => void sendLink(event)} className="flex flex-col gap-3">
              {providers.length > 0 && <p className="text-center text-xs text-fg-subtle">or</p>}
              <Field label="Email">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    spellCheck={false}
                    aria-describedby={describedBy}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" variant={primary === "email" ? "primary" : "secondary"} disabled={pending !== null}>
                Email Me a Link
              </Button>
            </form>
          )}
          {methods.isSuccess && providers.length === 0 && !methods.data.magicLink && (
            <p className="text-center text-sm text-fg-muted">Sign-in isn't configured yet.</p>
          )}
          {message && (
            <p role="status" className={message.tone === "ok" ? "text-sm text-ok" : "text-sm text-danger"}>
              {message.text}
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
