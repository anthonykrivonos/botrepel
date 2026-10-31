import { ASSURANCES, ASSURANCE_LABELS, type Assurance } from "../shared/assurance";
import { PRICE_MICROS, formatPerThousand } from "../shared/pricing";
import { cn } from "../utils/cn";

interface TierPickerProps {
  readonly value: Assurance;
  readonly onChange: (tier: Assurance) => void;
  readonly disabled?: boolean;
}

/** Native radios, so arrow keys and screen readers work without extra code. */
export function TierPicker({ value, onChange, disabled }: TierPickerProps): React.JSX.Element {
  return (
    <fieldset disabled={disabled} className="grid grid-cols-3 gap-1 rounded-control border border-line bg-well p-1">
      <legend className="sr-only">Check to try</legend>
      {ASSURANCES.map((tier) => (
        <label key={tier} className="relative">
          <input
            type="radio"
            name="demo-tier"
            value={tier}
            checked={value === tier}
            onChange={() => onChange(tier)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex h-full cursor-pointer flex-col gap-0.5 rounded-[4px] px-2.5 py-2 text-left transition-colors duration-150",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-info",
              value === tier ? "bg-surface-raised text-fg" : "text-fg-subtle hover:text-fg-muted",
            )}
          >
            <span className="text-xs font-medium sm:text-sm">{ASSURANCE_LABELS[tier]}</span>
            <span className="font-mono text-[11px] text-fg-subtle">{formatPerThousand(PRICE_MICROS[tier])}/1k</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
