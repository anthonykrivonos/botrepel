import { sha256 } from "./db";
import { SECRET_KEY_PREFIX, SITE_KEY_PREFIX, TOKEN_PREFIX } from "../src/shared/site";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Characters of a secret shown in the dashboard to tell keys apart. */
const SECRET_PREFIX_LENGTH = 10;

/** `length` characters of base62 from a CSPRNG; rejection sampling keeps it unbiased. */
export function randomId(length: number): string {
  let out = "";
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < 248 && out.length < length) {
        out += ALPHABET[byte % 62];
      }
    }
  }
  return out;
}

/** Public: it is in every customer page's HTML. 96 bits is plenty for an identifier. */
export const newSiteKey = (): string => SITE_KEY_PREFIX + randomId(16);

/** 190 bits; only its hash is stored. */
export function newSecretKey(): { secret: string; hash: string; prefix: string } {
  const secret = SECRET_KEY_PREFIX + randomId(32);
  return { secret, hash: sha256(secret), prefix: secret.slice(0, SECRET_KEY_PREFIX.length + SECRET_PREFIX_LENGTH - 6) };
}

export function newToken(): { token: string; hash: string } {
  const token = TOKEN_PREFIX + randomId(32);
  return { token, hash: sha256(token) };
}

/** Compares secrets without leaking where they differ. */
export function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
