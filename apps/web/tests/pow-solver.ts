import { leadingZeroBits, type PowPuzzle } from "../src/shared/pow";

/** Solves a puzzle the way the widget's worker does, for tests. */
export function solvePow(puzzle: PowPuzzle): string {
  for (let nonce = 0; ; nonce++) {
    const digest = new Bun.CryptoHasher("sha256").update(puzzle.seed + nonce).digest();
    if (leadingZeroBits(digest) >= puzzle.bits) {
      return String(nonce);
    }
  }
}
