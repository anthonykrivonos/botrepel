import { leadingZeroBits, type PowPuzzle } from "../src/shared/pow";

/** Server-side check: one hash. The nonce is a decimal string the client found. */
export function solves(puzzle: PowPuzzle, nonce: string): boolean {
  if (!/^\d{1,16}$/.test(nonce)) {
    return false;
  }
  const digest = new Bun.CryptoHasher("sha256").update(puzzle.seed + nonce).digest();
  return leadingZeroBits(digest) >= puzzle.bits;
}
