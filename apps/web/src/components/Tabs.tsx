import { useId, useState } from "react";
import { cn } from "../utils/cn";

export interface Tab {
  readonly label: string;
  readonly content: React.ReactNode;
}

interface TabsProps {
  readonly tabs: readonly Tab[];
  readonly label: string;
}

/** Arrow keys move between tabs, as the ARIA tabs pattern expects. */
export function Tabs({ tabs, label }: TabsProps): React.JSX.Element {
  const id = useId();
  const [active, setActive] = useState(0);

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step) {
      const next = (active + step + tabs.length) % tabs.length;
      setActive(next);
      document.getElementById(`${id}-tab-${next}`)?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex min-w-0 gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            className={cn(
              "-mb-px shrink-0 border-b px-3 pb-2.5 text-sm transition-colors duration-150",
              index === active ? "border-fg text-fg" : "border-transparent text-fg-subtle hover:text-fg-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel-${active}`} aria-labelledby={`${id}-tab-${active}`}>
        {tabs[active]?.content}
      </div>
    </div>
  );
}
