import { DemoCard } from "./DemoCard";
import { LightStage } from "./LightStage";
import { Glass } from "../components/Glass";
import { useHydrated } from "../hooks/useHydrated";

/** The hero's right column: the light figure above the live widget demo, frosted over the hero's glow. */
export function HeroDemo(): React.JSX.Element {
  const hydrated = useHydrated();
  return (
    <Glass className="animate-rise overflow-hidden rounded-dialog border-white/14 border-t-white/28 p-0 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)] [animation-delay:320ms]">
      <figure className="relative aspect-[4/3] bg-canvas">
        <LightStage className="absolute inset-0 size-full" />
        <figcaption className="pointer-events-none absolute top-4 right-4 left-4 flex justify-between font-mono text-[11px] text-fg-subtle">
          <span>FIG. 0 · Flash reflection</span>
          <span>&lt; 1 frame</span>
        </figcaption>
      </figure>
      <div className="border-t border-line p-4 sm:p-5">
        {/* The SDK's frame carries inline styles, which the CSP blocks in pre-rendered HTML; it mounts after hydration. */}
        {hydrated ? <DemoCard /> : <div className="h-[23rem]" aria-hidden="true" />}
      </div>
    </Glass>
  );
}
