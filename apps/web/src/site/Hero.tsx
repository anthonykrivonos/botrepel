import { AgentPromptHint } from "./AgentPromptHint";
import { HeroDemo } from "./HeroDemo";
import { buttonClassName } from "../components/Button";
import { CopyField } from "../components/CopyField";
import { useOrigin } from "../hooks/useOrigin";
import { agentPrompt } from "../shared/constants";

export function Hero(): React.JSX.Element {
  const origin = useOrigin();
  return (
    <section data-light className="relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 glow-light" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-28">
        <div data-entrance className="flex flex-col items-start gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/research/botrepel-whitepaper.pdf"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-line-strong glass pr-3 pl-1 text-sm text-fg-muted transition-colors duration-150 hover:text-fg"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2 py-0.5 text-xs text-fg">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[rgb(var(--light))]" />
                New
              </span>
              The research behind BotRepel
              <span aria-hidden="true">→</span>
            </a>
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-yc/30 bg-yc/10 pr-3 pl-1.5 text-sm whitespace-nowrap text-yc">
              <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
                <path d="M47.9985 47.9994H0V8.61853e-07H47.9985V47.9994Z" fill="currentColor" />
                <path
                  d="M13.9012 11.7843H17.6595L22.4961 21.5325C23.203 22.9836 23.7984 24.3976 23.7984 24.3976C23.7984 24.3976 24.4313 23.021 25.175 21.5325L30.0868 11.7843H33.5843L25.2865 27.3746V37.309H22.1244V27.1884L13.9012 11.7843Z"
                  fill="white"
                />
              </svg>
              Built by YC Alums
            </span>
          </div>
          <h1 className="font-display text-display-sm font-normal text-fg sm:text-display lg:text-[5.75rem] lg:leading-[0.94]">
            Human verification for websites
          </h1>
          <p className="max-w-lg text-lg text-fg-muted">
            The widget runs in your form, and your server verifies the token. Most visitors pass a background check. A
            stepped-up visit uses a passkey or a two-second camera sequence.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/login" className={buttonClassName("primary")}>
              Create an Account
            </a>
            <a href="#how-it-works" className={buttonClassName("ghost")}>
              How It Works
            </a>
          </div>
          <div className="mt-2 flex w-full max-w-lg flex-col gap-2">
            <AgentPromptHint />
            <CopyField value={agentPrompt(origin)} label="Copy prompt for your coding agent" kind="code" />
          </div>
        </div>
        <HeroDemo />
      </div>
    </section>
  );
}
