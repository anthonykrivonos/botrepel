/** Statistics over per-frame series, shared by the face finder and the analyzer. */

export type Series = Float64Array;

export function mean(values: Series): number {
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

export function standardDeviation(values: Series): number {
  const m = mean(values);
  let variance = 0;
  for (const value of values) {
    variance += (value - m) ** 2;
  }
  return Math.sqrt(variance / values.length);
}

/** Coefficient of variation: how much a series moves relative to its level. */
export function variation(values: Series): number {
  const m = mean(values);
  return m > 0 ? standardDeviation(values) / m : 0;
}

/** Pearson correlation of two equal-length series. */
export function correlation(a: Series, b: Series): number {
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i]! - ma;
    const db = b[i]! - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : 0;
}

/** Least-squares slope of `observed` against `expected`. */
export function slope(observed: Series, expected: Series): number {
  const mo = mean(observed);
  const me = mean(expected);
  let cov = 0;
  let ve = 0;
  for (let i = 0; i < observed.length; i++) {
    cov += (observed[i]! - mo) * (expected[i]! - me);
    ve += (expected[i]! - me) ** 2;
  }
  return ve > 0 ? cov / ve : 0;
}

/**
 * `values` minus its least-squares quadratic in time. Auto-exposure and white balance drift
 * slowly over the two seconds; the schedule moves faster, so this removes mostly drift.
 */
export function detrend(values: Series, times: Series): Series {
  const t0 = times[0]!;
  const span = Math.max(1, times[times.length - 1]! - t0);
  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const rhs = [0, 0, 0];
  for (let i = 0; i < values.length; i++) {
    const x = (times[i]! - t0) / span;
    const basis = [1, x, x * x];
    for (let j = 0; j < 3; j++) {
      rhs[j]! += basis[j]! * values[i]!;
      for (let k = 0; k < 3; k++) {
        normal[j]![k]! += basis[j]! * basis[k]!;
      }
    }
  }
  // Gaussian elimination on the 3×3 normal equations.
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const factor = normal[j]![i]! / normal[i]![i]!;
      for (let k = i; k < 3; k++) {
        normal[j]![k]! -= factor * normal[i]![k]!;
      }
      rhs[j]! -= factor * rhs[i]!;
    }
  }
  const weights = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let sum = rhs[i]!;
    for (let k = i + 1; k < 3; k++) {
      sum -= normal[i]![k]! * weights[k]!;
    }
    weights[i] = normal[i]![i]! ? sum / normal[i]![i]! : 0;
  }
  return values.map((value, i) => {
    const x = (times[i]! - t0) / span;
    return value - (weights[0]! + weights[1]! * x + weights[2]! * x * x);
  });
}
