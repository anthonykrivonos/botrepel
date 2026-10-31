import { z } from "zod";
import { SignalsSchema } from "./signals";
import { AssuranceSchema, ActionSchema } from "./site";

export type { HostToWidget, WidgetErrorCode, WidgetToHost } from "@botrepel/protocol";

export const StartChallengeSchema = z.object({
  siteKey: z.string().min(1).max(64),
  action: ActionSchema.default("*"),
  /** Reported by the widget; used only without a ticket, outside production. */
  hostname: z.string().min(1).max(253),
  /** The signed embed ticket from the challenge page; it fixes the hostname. */
  ticket: z.string().max(512).optional(),
  /** The host page can ask for more than the site's policy, never less. */
  minAssurance: AssuranceSchema.optional(),
});

export const InvisibleSubmitSchema = z.object({
  challengeId: z.string().min(1).max(64),
  nonce: z.string().min(1).max(16),
  signals: SignalsSchema.default({}),
});

export const LivenessStartSchema = z.object({ livenessId: z.string().min(1).max(64) });

/** WebAuthn responses: the shape here; the WebAuthn library verifies the contents. */
const encoded = z.string().min(1).max(16_384);
const credential = {
  id: z.string().min(1).max(1024),
  rawId: z.string().min(1).max(1024),
  type: z.literal("public-key"),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
};

export const PresenceSchema = z.object({
  presenceId: z.string().min(1).max(64),
  response: z.object({
    ...credential,
    response: z.object({
      clientDataJSON: encoded,
      authenticatorData: encoded,
      signature: encoded,
      userHandle: encoded.optional(),
    }),
  }),
});

export const PassRegisterSchema = z.object({
  anchorId: z.string().min(1).max(64),
  response: z.object({
    ...credential,
    response: z.object({
      clientDataJSON: encoded,
      attestationObject: encoded,
      transports: z
        .array(z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]))
        .max(8)
        .optional(),
    }),
  }),
});

export const FeedbackSchema = z.object({
  secret: z.string().min(1).max(128),
  pseudonym: z.string().min(1).max(64),
  reason: z.string().trim().min(1).max(200),
});
