/** Leading zero bits of sha256(seed ‖ nonce) the client must find; risk raises it. */
export const POW_BASE_BITS = 17;
export const POW_MAX_BITS = 21;

export interface PowPuzzle {
  readonly seed: string;
  readonly bits: number;
}

/** Counts leading zero bits of a digest. */
export function leadingZeroBits(digest: Uint8Array): number {
  let bits = 0;
  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

/** The difficulty for a risk score in [0, 1]: each extra bit doubles the expected work. */
export function powBitsFor(risk: number): number {
  return Math.min(POW_MAX_BITS, POW_BASE_BITS + Math.round(Math.max(0, risk) * (POW_MAX_BITS - POW_BASE_BITS)));
}
