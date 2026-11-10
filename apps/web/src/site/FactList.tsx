import { productFacts } from "./facts";

/** The same measured limits on the home page and the about page. */
export function FactList(): React.JSX.Element {
  return (
    <dl className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
      {productFacts().map((fact) => (
        <div key={fact.label} className="flex flex-col gap-2 bg-canvas p-5 sm:p-6">
          <dt className="text-sm text-fg-muted">{fact.label}</dt>
          <dd className="font-mono text-lg text-fg tabular-nums">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
