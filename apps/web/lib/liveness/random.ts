/** A float in [0, 1). Schedules and pose targets must be unpredictable, so the default is the CSPRNG. */
export type Random = () => number;

export const cryptoRandom: Random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
