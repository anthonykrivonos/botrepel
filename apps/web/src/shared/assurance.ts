import { ASSURANCES, meetsAssurance, type Assurance } from "@botrepel/protocol";

export { ASSURANCES, meetsAssurance, type Assurance };

export const ASSURANCE_LABELS: Readonly<Record<Assurance, string>> = {
  invisible: "Invisible check",
  presence: "Human Pass",
  liveness: "Flash liveness",
};

export function strongestAssurance(...levels: readonly Assurance[]): Assurance {
  return levels.reduce((best, level) => (meetsAssurance(level, best) ? level : best), "invisible");
}
