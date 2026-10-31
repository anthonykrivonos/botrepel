import { z } from "zod";

/** What the widget reports about its browser. Each can only raise risk: a bot can lie, never lower it. */
export const SignalsSchema = z
  .object({
    webdriver: z.boolean().optional(),
    /** A DevTools-protocol client touched a stack getter during serialization. */
    cdp: z.boolean().optional(),
    /** The user agent says headless, or disagrees with client hints. */
    headless: z.boolean().optional(),
    /** Window metrics only automation produces (zero outer size). */
    zeroWindow: z.boolean().optional(),
    /** Milliseconds the proof of work took; with the nonce, a hash rate no browser reaches means offloading. */
    solveMs: z.number().nonnegative().max(600_000).optional(),
  })
  .strict();

export type Signals = z.infer<typeof SignalsSchema>;
