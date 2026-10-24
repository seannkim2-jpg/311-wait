/**
 * src/lib/stats.ts
 *
 * Pure TypeScript statistics module. No runtime dependencies, no React, no fetch.
 * All functions are exported and operate only on plain data.
 *
 * Functions:
 *   parsePgInterval   – Postgres interval string → hours
 *   naiveMedian       – closed-cases-only median
 *   kaplanMeier       – KM step curve + Greenwood SE + median
 *   aalenJohansen     – competing-risks CIF (cause 1=resolved, 2=admin-closed)
 *   wilson            – Wilson score CI for a proportion
 *   logRank           – log-rank chi-square test, 1 df
 *   benjaminiHochberg – BH multiple testing correction
 */

// ---------------------------------------------------------------------------
// parsePgInterval
// ---------------------------------------------------------------------------

/**
 * Parse a Postgres interval string into total hours.
 *
 * Accepted forms:
 *   "13 days, 12:33:42.319741"
 *   "1 day, 00:00:01"
 *   "9:32:19.776794"          (bare HMS, no day component)
 *   "HH:MM:SS"                (no fractional seconds)
 *
 * Throws if the string matches none of the above forms.
 */
export function parsePgInterval(s: string): number {
  // Normalise: trim whitespace
  const str = s.trim();

  // Pattern 1: optional "D day[s], " prefix, followed by HH:MM:SS[.ffffff]
  // Captures: (days?), HH, MM, SS[.ffffff]
  const full =
    /^(?:(\d+)\s+days?,\s*)?(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/i.exec(str);

  if (!full) {
    throw new Error(`parsePgInterval: unrecognized format: "${s}"`);
  }

  const days = full[1] !== undefined ? parseInt(full[1], 10) : 0;
  const hh = parseInt(full[2], 10);
  const mm = parseInt(full[3], 10);
  const ss = parseFloat(full[4]);

  return days * 24 + hh + mm / 60 + ss / 3600;
}

/**
 * Format a duration as a canonical Postgres-style interval string, suitable
 * for round-tripping through parsePgInterval.
 *
 * Output: "D days, HH:MM:SS.ffffff" (always 6 decimal places; always plural "days"
 * even for D=1, because the parser accepts both "day" and "days").
 */
export function formatPgInterval(days: number, hours: number, minutes: number, seconds: number): string {
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  // Always 6 decimal places for the seconds part
  const ss = seconds.toFixed(6).padStart(9, '0'); // e.g. "01.000000"
  if (days === 0) {
    return `${hh}:${mm}:${ss}`;
  }
  return `${days} days, ${hh}:${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// naiveMedian
// ---------------------------------------------------------------------------

/**
 * Compute the median of an array of durations (hours).
 * For the closed-cases-only naive estimator used in the bias callout.
 * Returns NaN for an empty array.
 */
export function naiveMedian(hours: number[]): number {
  if (hours.length === 0) return NaN;
  const sorted = [...hours].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Kaplan-Meier
// ---------------------------------------------------------------------------

export interface KMObservation {
  hours: number;
  event: boolean; // true = event occurred (case closed), false = censored (still open)
}

export interface KMStep {
  t: number;        // event time (hours)
  s: number;        // S(t): survival probability at this step
  atRisk: number;   // number at risk just before t
  events: number;   // number of events at t
  se: number;       // Greenwood standard error of S(t)
}

export interface KMResult {
  curve: KMStep[];
  median: number | null; // first t where S(t) <= 0.5; null if never reached
}

/**
 * Kaplan-Meier product-limit estimator.
 *
 * Algorithm:
 *   1. Sort observations by hours (ascending).
 *   2. At each unique event time tᵢ with dᵢ events and nᵢ at-risk:
 *      S(tᵢ) = S(tᵢ₋₁) × (1 − dᵢ / nᵢ)
 *   3. Greenwood SE:
 *      SE[S(t)] = S(t) × sqrt( Σᵢ dᵢ / (nᵢ × (nᵢ − dᵢ)) )
 *      (sum over all event times ≤ t; skip terms where nᵢ = dᵢ to avoid div-by-zero)
 *
 * Ties: all censored observations tied at the same time as events are treated as
 * occurring after the event (standard convention).
 */
export function kaplanMeier(obs: KMObservation[]): KMResult {
  if (obs.length === 0) return { curve: [], median: null };

  // Sort: events before censored at same time (standard convention)
  const sorted = [...obs].sort((a, b) => {
    if (a.hours !== b.hours) return a.hours - b.hours;
    // events first
    return (a.event ? 0 : 1) - (b.event ? 0 : 1);
  });

  const n = sorted.length;
  const curve: KMStep[] = [];
  let s = 1.0;
  let greenwoodSum = 0.0; // Σ dᵢ / (nᵢ × (nᵢ − dᵢ))
  let median: number | null = null;
  let i = 0;

  while (i < n) {
    // Skip censored observations (they don't generate steps)
    if (!sorted[i].event) {
      i++;
      continue;
    }

    const t = sorted[i].hours;
    // Count events at this time
    let d = 0;
    let j = i;
    while (j < n && sorted[j].hours === t && sorted[j].event) {
      d++;
      j++;
    }

    // Count at-risk: all observations with hours >= t
    // Since sorted ascending, at-risk = n - i (index of first obs at time t)
    const atRisk = n - i;

    // KM update
    s = s * (1 - d / atRisk);

    // Greenwood update (guard against degenerate case atRisk == d)
    if (atRisk > d) {
      greenwoodSum += d / (atRisk * (atRisk - d));
    }
    const se = s * Math.sqrt(greenwoodSum);

    curve.push({ t, s, atRisk, events: d, se });

    // Median: first time S <= 0.5
    if (median === null && s <= 0.5) {
      median = t;
    }

    i = j;
  }

  return { curve, median };
}

// ---------------------------------------------------------------------------
// Aalen-Johansen
// ---------------------------------------------------------------------------

export type AJCause = 0 | 1 | 2;
// 0 = censored (still open)
// 1 = genuinely resolved
// 2 = administratively closed (Noted, Transitioned)

export interface AJObservation {
  hours: number;
  cause: AJCause;
}

export interface AJCurvePoint {
  t: number;
  cif: number; // cumulative incidence F(t) for this cause
}

export interface AJResult {
  curve1: AJCurvePoint[]; // cause 1: genuine resolution
  curve2: AJCurvePoint[]; // cause 2: admin closure
  final1: number;          // F₁(∞): probability of genuine resolution
  final2: number;          // F₂(∞): probability of admin closure
  stillUnresolved: number; // 1 - final1 - final2 (must be within 1e-9 of open/n)
}

/**
 * Aalen-Johansen competing-risks estimator.
 *
 * Correct treatment of Noted/Transitioned closures as competing events, not censoring.
 * KM treating them as censored would falsely assume those cases would eventually resolve.
 *
 * Algorithm:
 *   1. Sort observations by hours.
 *   2. Maintain overall survival S(t) = product over all unique event times
 *      (events = cause 1 OR cause 2) of (1 − (d₁ᵢ + d₂ᵢ) / nᵢ).
 *   3. At each unique event time tᵢ, for each cause k:
 *      ΔFₖ(tᵢ) = S(tᵢ₋) × dᵢₖ / nᵢ
 *   4. Fₖ(t) = Σᵢ:tᵢ≤t ΔFₖ(tᵢ)
 *
 * Invariant: F₁(∞) + F₂(∞) + (1 − F₁(∞) − F₂(∞)) = 1 exactly.
 * The stillUnresolved value equals the proportion of observations with cause=0.
 */
export function aalenJohansen(obs: AJObservation[]): AJResult {
  const n = obs.length;
  if (n === 0) {
    return { curve1: [], curve2: [], final1: 0, final2: 0, stillUnresolved: 1 };
  }

  // Sort: events (cause 1 or 2) before censored at same time
  const sorted = [...obs].sort((a, b) => {
    if (a.hours !== b.hours) return a.hours - b.hours;
    // events before censored
    return (a.cause === 0 ? 1 : 0) - (b.cause === 0 ? 1 : 0);
  });

  const curve1: AJCurvePoint[] = [];
  const curve2: AJCurvePoint[] = [];

  let s = 1.0;    // S(t-): overall survival just before current event time
  let f1 = 0.0;   // cumulative incidence cause 1
  let f2 = 0.0;   // cumulative incidence cause 2
  let i = 0;

  while (i < n) {
    // Skip censored observations
    if (sorted[i].cause === 0) {
      i++;
      continue;
    }

    const t = sorted[i].hours;

    // Count events at this time by cause
    let d1 = 0;
    let d2 = 0;
    let j = i;
    while (j < n && sorted[j].hours === t && sorted[j].cause !== 0) {
      if (sorted[j].cause === 1) d1++;
      else if (sorted[j].cause === 2) d2++;
      j++;
    }

    // At-risk count: n - i (all remaining observations, including those at time t)
    const atRisk = n - i;
    const dTotal = d1 + d2;

    // AJ increments: ΔFₖ = S(t-) × dₖ / n
    const sPrev = s;
    f1 += sPrev * d1 / atRisk;
    f2 += sPrev * d2 / atRisk;

    // Update overall survival
    s = s * (1 - dTotal / atRisk);

    curve1.push({ t, cif: f1 });
    curve2.push({ t, cif: f2 });

    i = j;
  }

  const stillUnresolved = 1.0 - f1 - f2;

  return { curve1, curve2, final1: f1, final2: f2, stillUnresolved };
}

// ---------------------------------------------------------------------------
// Wilson score interval
// ---------------------------------------------------------------------------

export interface WilsonInterval {
  lower: number;
  upper: number;
}

/**
 * Wilson score confidence interval for a proportion.
 *
 * Correct at p=0 and p=1 (does not collapse to a point, unlike normal approximation).
 * Both bounds clipped to [0, 1].
 *
 * @param successes  Number of successes (k)
 * @param n          Total observations
 * @param z          z-score (default 1.96 for 95% CI)
 */
export function wilson(successes: number, n: number, z = 1.96): WilsonInterval {
  if (n <= 0) throw new Error('wilson: n must be > 0');
  if (successes < 0 || successes > n) throw new Error('wilson: successes must be in [0, n]');

  const z2 = z * z;
  const p = successes / n;

  const center = (successes + z2 / 2) / (n + z2);
  const margin = (z / (n + z2)) * Math.sqrt(successes * (n - successes) / n + z2 / 4);

  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);

  return { lower, upper };
}

// ---------------------------------------------------------------------------
// Log-rank test
// ---------------------------------------------------------------------------

export interface LogRankResult {
  statistic: number; // chi-square statistic, 1 df
  pValue: number;
}

/**
 * Log-rank test comparing two independent survival curves.
 *
 * Uses the Mantel-Haenszel form. At each unique event time across both groups:
 *   O₁ᵢ = observed events in group 1
 *   E₁ᵢ = expected events in group 1 = n₁ᵢ × (O₁ᵢ + O₂ᵢ) / (n₁ᵢ + n₂ᵢ)
 * χ² = (Σ(O₁ᵢ - E₁ᵢ))² / Var, where Var is the hypergeometric variance sum.
 */
export function logRank(
  a: KMObservation[],
  b: KMObservation[],
): LogRankResult {
  // Collect all unique event times
  const times = new Set<number>();
  for (const o of a) if (o.event) times.add(o.hours);
  for (const o of b) if (o.event) times.add(o.hours);

  const sortedTimes = [...times].sort((x, y) => x - y);

  let sumO1E1 = 0; // Σ (O₁ᵢ − E₁ᵢ)
  let sumVar = 0;  // Σ Var(O₁ᵢ)

  for (const t of sortedTimes) {
    // At-risk counts at time t
    const n1 = a.filter(o => o.hours >= t).length;
    const n2 = b.filter(o => o.hours >= t).length;
    const nTotal = n1 + n2;
    if (nTotal === 0) continue;

    // Event counts at time t (not censored)
    const o1 = a.filter(o => o.hours === t && o.event).length;
    const o2 = b.filter(o => o.hours === t && o.event).length;
    const oTotal = o1 + o2;
    if (oTotal === 0) continue;

    const e1 = (n1 / nTotal) * oTotal;
    sumO1E1 += o1 - e1;

    // Hypergeometric variance
    if (nTotal > 1) {
      sumVar += (n1 * n2 * oTotal * (nTotal - oTotal)) / (nTotal * nTotal * (nTotal - 1));
    }
  }

  if (sumVar === 0) return { statistic: 0, pValue: 1 };

  const statistic = (sumO1E1 * sumO1E1) / sumVar;
  const pValue = 1 - chi2cdf(statistic, 1);

  return { statistic, pValue };
}

/**
 * Chi-squared CDF for 1 degree of freedom.
 * Equivalent to regularised incomplete gamma P(1/2, x/2).
 * Uses the erf approximation.
 */
function chi2cdf(x: number, _df: 1): number {
  if (x <= 0) return 0;
  // CDF of chi-squared(1) = erf(sqrt(x/2))
  return erf(Math.sqrt(x / 2));
}

/**
 * Error function via Horner's method approximation (Abramowitz & Stegun 7.1.26).
 * Max absolute error < 1.5e-7.
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    t * (0.254829592 +
      t * (-0.284496736 +
        t * (1.421413741 +
          t * (-1.453152027 +
            t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-x * x));
}

// ---------------------------------------------------------------------------
// Benjamini-Hochberg
// ---------------------------------------------------------------------------

/**
 * Benjamini-Hochberg multiple testing correction.
 *
 * Returns adjusted p-values (BH-corrected) with the following properties:
 *   - Monotone: if pᵢ ≤ pⱼ then adjusted(pᵢ) ≤ adjusted(pⱼ)
 *   - Never below the original: adjusted(pᵢ) ≥ pᵢ for all i
 *   - All values in [0, 1]
 *
 * Algorithm (step-up procedure):
 *   1. Sort p-values ascending with original indices.
 *   2. adjusted_rank_k = p_k × m / k  (clipped to [0,1])
 *   3. Enforce monotonicity from largest rank downward (cummin from right).
 *   4. Return in original order.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length;
  if (m === 0) return [];

  // Sort by p-value ascending, track original indices
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  // Compute raw BH-adjusted values: p_k * m / rank (rank is 1-based)
  const adjusted = indexed.map(({ p }, rank0) => {
    const rank = rank0 + 1;
    return Math.min(1, (p * m) / rank);
  });

  // Enforce monotonicity: step down from the largest p-value
  // adjusted[k] = min(adjusted[k], adjusted[k+1], ..., adjusted[m-1])
  for (let k = m - 2; k >= 0; k--) {
    adjusted[k] = Math.min(adjusted[k], adjusted[k + 1]);
  }

  // Map back to original order
  const result = new Array<number>(m);
  for (let rank0 = 0; rank0 < m; rank0++) {
    result[indexed[rank0].i] = adjusted[rank0];
  }

  return result;
}
