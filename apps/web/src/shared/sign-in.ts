import { z } from "zod";

export const MAGIC_LINK_EXPIRES_SECONDS = 300;

/** The CLI's OAuth client id for the device authorization flow. */
export const CLI_CLIENT_ID = "botrepel-cli";

/** Where people approve a CLI sign-in; also the device flow's verification URI. */
export const DEVICE_PAGE_PATH = "/device";

/** A path on this site; an absolute URL could send people elsewhere after signing in. */
const sitePath = z.string().startsWith("/", { error: "Sign-in can only return to a page on this site." });

export const MagicLinkSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }).max(254, { error: "That email address is too long." }),
  callbackURL: sitePath.optional(),
  errorCallbackURL: sitePath.optional(),
});
