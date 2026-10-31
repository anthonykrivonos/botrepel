import { isProduction, type Env } from "./env";
import { serializeError } from "./errors";
import { Logger } from "./logger";
import { SITE_NAME } from "../src/shared/constants";
import { escapeHtml } from "../src/shared/utils";

const SEND_TIMEOUT_MS = 10_000;

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Plain paragraphs; the HTML version is rendered from them. */
  readonly paragraphs: readonly string[];
  readonly action?: { readonly label: string; readonly url: string };
  /** Resend drops a repeated send with the same key within 24 hours. */
  readonly idempotencyKey?: string;
}

export type SendEmail = (message: EmailMessage) => Promise<void>;

const logger = new Logger("email");

export function renderEmail(message: EmailMessage): { html: string; text: string } {
  const text = [
    ...message.paragraphs,
    ...(message.action ? [`${message.action.label}: ${message.action.url}`] : []),
  ].join("\n\n");
  const paragraphs = message.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;color:#d4d4d8;line-height:24px">${escapeHtml(paragraph)}</p>`)
    .join("");
  const action = message.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(message.action.url)}" style="display:inline-block;background:#fcfcfd;color:#000;padding:10px 16px;border-radius:6px;font-weight:500;text-decoration:none">${escapeHtml(message.action.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#000;padding:32px 16px;font-family:Inter,system-ui,sans-serif;font-size:15px"><div style="max-width:480px;margin:0 auto"><p style="margin:0 0 24px;color:#fcfcfd;font-weight:500">${SITE_NAME}</p>${paragraphs}${action}</div></body></html>`;
  return { html, text };
}

/** Resend in production; outside production without Resend, each message is logged so local sign-in works. */
export function emailSender(env: Env): SendEmail | null {
  const { RESEND_API_KEY: key, EMAIL_FROM: from } = env;
  if (key && from) {
    return async (message) => {
      const { html, text } = renderEmail(message);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({ from, to: message.to, subject: message.subject, html, text }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Resend answered ${response.status}`);
      }
    };
  }
  if (isProduction(env)) {
    return null;
  }
  return async (message) => {
    try {
      logger.info(`Local email to ${message.to}: ${message.subject}\n${renderEmail(message).text}`);
    } catch (error) {
      logger.error("Could not render a local email", { cause: serializeError(error) });
    }
  };
}
