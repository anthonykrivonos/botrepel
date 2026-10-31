import { glassClassName } from "../components/Glass";
import { useReveal } from "../hooks/useReveal";
import { cn } from "../utils/cn";

interface LayerRowProps {
  readonly index: number;
  readonly name: string;
  readonly title: string;
  readonly body: string;
  readonly facts: readonly string[];
  readonly caption: string;
  readonly figure: React.ReactNode;
  /** Puts the figure on the left, so rows alternate. */
  readonly flip?: boolean;
}

/** One numbered layer: copy and facts beside a captioned figure. */
export function LayerRow({ index, name, title, body, facts, caption, figure, flip }: LayerRowProps): React.JSX.Element {
  const ref = useReveal<HTMLLIElement>();
  return (
    <li ref={ref} className="grid items-center gap-10 border-t border-line py-14 lg:grid-cols-2 lg:gap-16">
      <div className={cn("flex flex-col gap-4", flip && "lg:order-2")}>
        <p className="flex items-center gap-3 text-sm text-fg-subtle">
          <span className="font-mono">0{index}</span>
          {name}
        </p>
        <h3 className="font-display text-[2rem] leading-tight font-normal">{title}</h3>
        <p className="text-fg-muted">{body}</p>
        <ul data-stagger className="mt-2 flex flex-col gap-2 text-sm text-fg-body">
          {facts.map((fact) => (
            <li key={fact} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-fg-subtle" />
              {fact}
            </li>
          ))}
        </ul>
      </div>
      <figure className={glassClassName("p-4 sm:p-6")}>
        {figure}
        <figcaption className="mt-4 border-t border-line pt-3 font-mono text-[11px] text-fg-subtle">
          FIG. {index} · {caption}
        </figcaption>
      </figure>
    </li>
  );
}
