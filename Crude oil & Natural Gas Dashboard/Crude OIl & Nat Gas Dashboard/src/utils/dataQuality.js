// Data-quality checks run over every fetched series before it's trusted for
// display or calculation. These exist so a bad data point (a stale
// discontinued source, a duplicate date, an impossible price) shows up as a
// visible warning instead of silently producing a wrong-looking chart.
//
// Nothing here mutates or drops data — checks only annotate. Hiding a real
// observation because it looks weird is exactly the kind of silent
// fabrication this module is meant to prevent; extreme values get flagged,
// not deleted.

const DAY_MS = 24 * 60 * 60 * 1000;

// How old the last observation can be before a series counts as "stale",
// per reporting frequency.
//
// daily: EIA's daily petroleum/nat-gas series routinely lag 2-4 real days
// even in a normal week, and a single 3-day holiday weekend (e.g. July
// 4th) pushes that past a week — 10 days absorbs that without flagging
// genuinely current data as stale.
//
// weekly: EIA's weekly reports (inventory, production, storage, etc.)
// publish ~5-8 days after their "week ending" date, on a 7-day cycle. The
// most recently available week is oldest right before the *next* report
// lands — 7 (cycle) + 8 (worst-case publish lag) = 15 days covers that
// worst case without a day-of-week-dependent false "STALE" flag.
const STALE_THRESHOLD_MS = {
  daily: 10 * DAY_MS,
  weekly: 15 * DAY_MS
};

// Default day-over-day move (as a fraction) beyond which a daily price
// series gets an "extreme jump" warning. This is intentionally generous —
// it's meant to catch decimal-shift/unit-mismatch-shaped errors, not to
// flag every volatile trading day.
const DEFAULT_JUMP_THRESHOLD = 0.4;

/** The six health states Data Health (and every panel's source badge) can show. */
export const STATUS = {
  CURRENT: 'CURRENT',
  STALE: 'STALE',
  HISTORICAL: 'HISTORICAL',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  FAILED: 'FAILED',
  UNAVAILABLE: 'UNAVAILABLE'
};

/**
 * Runs missing/duplicate/non-monotonic/staleness/range/jump checks over a
 * single [{date, value}] series (ascending by date) using its instrument
 * metadata (see instruments.js) for plausible-range and frequency context.
 * This is the raw anomaly detector — it does not know about credentials or
 * source discontinuation, see describeQueryHealth() for the full picture.
 *
 * Returns `{ warnings, isStale, lastObservationDate, ageDays, extremeJumps }`.
 */
export function checkSeries(series, meta, { now = Date.now() } = {}) {
  const warnings = [];
  const safeSeries = series ?? [];

  if (safeSeries.length === 0) {
    return { warnings: [], isStale: true, lastObservationDate: null, ageDays: null, extremeJumps: [] };
  }

  // Duplicate dates
  const seen = new Set();
  const duplicates = new Set();
  for (const point of safeSeries) {
    if (seen.has(point.date)) duplicates.add(point.date);
    seen.add(point.date);
  }
  if (duplicates.size > 0) {
    warnings.push({ severity: 'warn', message: `Duplicate observation date(s): ${[...duplicates].join(', ')}` });
  }

  // Non-monotonic dates (series is expected pre-sorted ascending by the hook)
  for (let i = 1; i < safeSeries.length; i++) {
    if (new Date(safeSeries[i].date) < new Date(safeSeries[i - 1].date)) {
      warnings.push({ severity: 'warn', message: `Dates are not monotonically increasing near ${safeSeries[i].date}.` });
      break;
    }
  }

  // Suspicious / out-of-range values
  if (meta?.plausibleRange) {
    const [min, max] = meta.plausibleRange;
    const outOfRange = safeSeries.filter((p) => p.value < min || p.value > max);
    if (outOfRange.length > 0) {
      warnings.push({
        severity: 'warn',
        message: `${outOfRange.length} observation(s) outside the plausible range [${min}, ${max}] ${meta.unit}: most recent at ${outOfRange[outOfRange.length - 1].date} = ${outOfRange[outOfRange.length - 1].value}.`
      });
    }
  }

  // Extreme one-day jumps (daily series only — weekly/monthly series move
  // for structural reasons and would false-positive constantly)
  const extremeJumps = [];
  if (meta?.frequency === 'daily') {
    for (let i = 1; i < safeSeries.length; i++) {
      const prev = safeSeries[i - 1].value;
      const curr = safeSeries[i].value;
      if (prev === 0) continue;
      const pctChange = (curr - prev) / Math.abs(prev);
      if (Math.abs(pctChange) >= DEFAULT_JUMP_THRESHOLD) {
        extremeJumps.push({ date: safeSeries[i].date, from: prev, to: curr, pctChange });
      }
    }
    if (extremeJumps.length > 0) {
      const last = extremeJumps[extremeJumps.length - 1];
      warnings.push({
        severity: 'info',
        message: `Extreme one-day move on ${last.date}: ${last.from} → ${last.to} (${(last.pctChange * 100).toFixed(0)}%). Verified against source — not a data error, but flagged since it drives 52W high/low.`
      });
    }
  }

  const lastObservationDate = safeSeries[safeSeries.length - 1].date;
  const ageDays = Math.floor((now - new Date(lastObservationDate).getTime()) / DAY_MS);
  const threshold = STALE_THRESHOLD_MS[meta?.frequency] ?? STALE_THRESHOLD_MS.daily;
  const isStale = now - new Date(lastObservationDate).getTime() > threshold;
  if (isStale) {
    warnings.push({ severity: 'warn', message: `Last observation (${lastObservationDate}) is ${ageDays} day(s) old.` });
  }

  return { warnings, isStale, lastObservationDate, ageDays, extremeJumps };
}

/**
 * Combines a React Query result with instrument metadata and (for
 * credentialed sources) key-configuration status into one health record
 * with a single unambiguous `status`:
 *
 *   NOT_CONFIGURED — optional integration, credential missing. Never FAILED.
 *   HISTORICAL     — source-side discontinuation (e.g. EIA's futures feed).
 *                    Real data, not live — never counts as a live-feed failure.
 *   FAILED         — a source that should work (core, or optional+configured)
 *                    has no usable data because the request failed.
 *   UNAVAILABLE    — no data and no error (feature not wired up / never fetched).
 *   STALE          — has data, but either the latest refresh failed (showing
 *                    last-known-good) or the last observation is older than
 *                    its frequency's staleness threshold.
 *   CURRENT        — has fresh data and the latest refresh succeeded.
 *
 * `keyStatus` is the /api/keycheck response ({ eia, alphaVantage, fred }).
 */
export function describeQueryHealth(instrumentKey, meta, query, keyStatus) {
  const base = { key: instrumentKey, name: meta?.name ?? instrumentKey, source: meta?.source ?? 'unknown', tier: meta?.tier ?? 'core' };
  const quality = checkSeries(query.data, meta);
  const hasData = Boolean(query.data && query.data.length > 0);
  const common = {
    lastObservationDate: quality.lastObservationDate,
    lastRefresh: query.dataUpdatedAt || null,
    ageDays: quality.ageDays,
    extremeJumps: quality.extremeJumps
  };

  if (meta?.requiresKey && keyStatus && keyStatus[meta.requiresKey] === false) {
    return {
      ...base,
      ...common,
      status: STATUS.NOT_CONFIGURED,
      warnings: [{ severity: 'info', message: `Optional integration — add ${meta.requiresKeyEnvVar} to enable.` }]
    };
  }

  if (meta?.discontinuedAfter) {
    return {
      ...base,
      ...common,
      status: STATUS.HISTORICAL,
      warnings: [
        { severity: 'info', message: `Source discontinued this dataset after ${meta.discontinuedAfter} — historical reference only, not a live feed.` },
        ...quality.warnings.filter((w) => !w.message.startsWith('Last observation'))
      ]
    };
  }

  if (!hasData) {
    return {
      ...base,
      ...common,
      status: query.isError ? STATUS.FAILED : STATUS.UNAVAILABLE,
      warnings: [{ severity: 'error', message: query.isError ? 'Request failed — no data available.' : 'No data available yet.' }]
    };
  }

  if (query.isError) {
    return {
      ...base,
      ...common,
      status: STATUS.STALE,
      warnings: [
        { severity: 'warn', message: `Refresh failed — showing last known-good observation from ${quality.lastObservationDate}.` },
        ...quality.warnings
      ]
    };
  }

  return {
    ...base,
    ...common,
    status: quality.isStale ? STATUS.STALE : STATUS.CURRENT,
    warnings: quality.warnings
  };
}

/**
 * Summarizes a list of describeQueryHealth() records into the one-line
 * status the user sees without expanding the panel, e.g.
 * "6/6 core data sources current · 2 historical datasets · 2 optional integrations not configured".
 */
export function summarizeHealth(records) {
  const core = records.filter((r) => r.tier === 'core');
  const coreCurrent = core.filter((r) => r.status === STATUS.CURRENT).length;
  const historical = records.filter((r) => r.tier === 'historical').length;

  const optional = records.filter((r) => r.tier === 'optional');
  const optionalProviders = new Set(optional.map((r) => r.source));
  const notConfiguredProviders = new Set(
    optional.filter((r) => r.status === STATUS.NOT_CONFIGURED).map((r) => r.source)
  );

  const coreFailedOrStale = core.filter((r) => r.status === STATUS.FAILED || r.status === STATUS.STALE).length;

  const parts = [`${coreCurrent}/${core.length} core data sources current`];
  if (historical > 0) parts.push(`${historical} historical dataset${historical === 1 ? '' : 's'}`);
  if (notConfiguredProviders.size > 0) {
    parts.push(`${notConfiguredProviders.size} optional integration${notConfiguredProviders.size === 1 ? '' : 's'} not configured`);
  }
  const configuredOptionalFailed = optional.filter(
    (r) => r.status === STATUS.FAILED && !notConfiguredProviders.has(r.source)
  ).length;
  if (configuredOptionalFailed > 0) {
    parts.push(`${configuredOptionalFailed} optional source(s) failed`);
  }

  return {
    summary: parts.join(' · '),
    healthy: coreFailedOrStale === 0,
    coreCurrent,
    coreTotal: core.length,
    historicalCount: historical,
    optionalProviderCount: optionalProviders.size,
    notConfiguredProviderCount: notConfiguredProviders.size
  };
}
