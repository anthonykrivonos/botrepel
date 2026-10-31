import { extendTailwindMerge } from "tailwind-merge";

// The radius tokens from styles.css, so an override like rounded-dialog replaces rounded-card.
const twMerge = extendTailwindMerge({ extend: { theme: { radius: ["control", "card", "dialog"] } } });

export const cn = (...names: (string | false | null | undefined)[]): string => twMerge(names);
