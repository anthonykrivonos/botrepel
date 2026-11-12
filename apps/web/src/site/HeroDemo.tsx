import { DemoCard } from "./DemoCard";
import { useHydrated } from "../hooks/useHydrated";

/** An interactive product sample. No simulated success or camera access on page load. */
export function HeroDemo(): React.JSX.Element {
  const hydrated = useHydrated();
  return (
    <section
      id="demo"
      aria-labelledby="demo-heading"
      className="scroll-mt-24 overflow-hidden rounded-dialog border border-line-strong bg-surface-raised"
    >
      <div className="flex flex-col gap-3 p-6 pb-5 sm:p-8 sm:pb-6">
        <h2 id="demo-heading" className="font-display text-[2rem] leading-tight font-normal">
          See what your visitors see
        </h2>
        <p className="text-sm text-fg-muted">
          This is the real widget. Choose a check, then run it to try the experience before adding it to your site.
        </p>
      </div>
      <div className="px-6 pb-6 sm:px-8 sm:pb-8">
        {/* The SDK mounts after hydration because the CSP blocks its inline styles in pre-rendered HTML. */}
        {hydrated ? (
          <DemoCard />
        ) : (
          <p className="min-h-48 text-sm text-fg-muted" aria-busy="true">
            Loading the demo. JavaScript is needed to run a check.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-line bg-surface px-6 py-5 sm:px-8">
        <p className="text-sm text-fg-muted">
          Browser signals can raise the check you choose. A camera check asks for permission before it starts.
        </p>
        <a href="#privacy" className="w-fit text-sm text-fg underline underline-offset-4">
          What happens to visitor data?
        </a>
      </div>
    </section>
  );
}
