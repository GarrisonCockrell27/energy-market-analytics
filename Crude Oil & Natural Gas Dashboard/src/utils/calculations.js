// Core quantitative logic for CrudeEdge: the oil-gas ratio, its z-score
// signal, the 3:2:1 crack spread approximation, contango/backwardation
// regime detection, and paper-trade P&L math.
import { TRADE_INSTRUMENTS } from './instruments.js';

/** Arithmetic mean of a numeric array. Returns null for an empty array. */
export function mean(values) {
  if (!values || values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample standard deviation (n-1 denominator) of a numeric array. */
export function stdDev(values) {
  if (!values || values.length < 2) return null;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Z-score: how many standard deviations `value` sits from the mean of
 * `series`. This is the core "spread signal" — a ratio reading of +2 means
 * it's unusually rich vs its own recent history, -2 means unusually cheap,
 * and most readings should fall within +/-1 in a mean-reverting regime.
 */
export function zScore(value, series) {
  const m = mean(series);
  const sd = stdDev(series);
  if (m === null || sd === null || sd === 0) return null;
  return (value - m) / sd;
}

/**
 * Percentile rank (0-100): the share of historical observations at or
 * below `value`. Complements the z-score with a distribution-shape-free
 * read — useful since a ratio series isn't guaranteed to be normally
 * distributed, so "z-score of +1.5" and "92nd percentile" can legitimately
 * disagree at the tails.
 */
export function percentileRank(value, series) {
  if (!series || series.length === 0 || value === null || value === undefined) return null;
  const countAtOrBelow = series.filter((v) => v <= value).length;
  return (countAtOrBelow / series.length) * 100;
}

/** WTI/Henry Hub price ratio — the classic "oil-to-gas ratio" traders watch. */
export function oilGasRatio(wtiPrice, hhPrice) {
  if (!wtiPrice || !hhPrice) return null;
  return wtiPrice / hhPrice;
}

/**
 * Builds an aligned oil-gas ratio series from two date-keyed price series.
 * Only dates present in both series are included, sorted ascending by date.
 */
export function buildRatioSeries(wtiSeries, hhSeries) {
  const hhByDate = new Map(hhSeries.map((p) => [p.date, p.value]));
  return wtiSeries
    .filter((p) => hhByDate.has(p.date))
    .map((p) => ({ date: p.date, ratio: oilGasRatio(p.value, hhByDate.get(p.date)) }))
    .filter((p) => p.ratio !== null)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Inner-joins any number of [{date, value}] series on shared observation
 * dates, so a spread/ratio/crack calculation never silently mixes values
 * from two different dates just because each series' *own* latest point
 * happened to land on a different day (e.g. one instrument lags another
 * by a publishing day). Returns rows sorted ascending by date, shaped as
 * `{ date, values: { [key]: value } }`.
 *
 * Pass a `{ key: series }` map; only dates present in every series survive.
 */
export function alignSeriesByDate(namedSeriesMap) {
  const entries = Object.entries(namedSeriesMap);
  if (entries.length === 0) return [];

  const [firstKey, firstSeries] = entries[0];
  const otherMaps = entries.slice(1).map(([key, series]) => [key, new Map(series.map((p) => [p.date, p.value]))]);

  const rows = [];
  for (const point of firstSeries) {
    const values = { [firstKey]: point.value };
    let hasAll = true;
    for (const [key, map] of otherMaps) {
      if (!map.has(point.date)) {
        hasAll = false;
        break;
      }
      values[key] = map.get(point.date);
    }
    if (hasAll) rows.push({ date: point.date, values });
  }

  return rows.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Standard-deviation bands (mean +/- 1 and 2 sigma) for a ratio series,
 * used to overlay on the 90-day spread chart.
 */
export function ratioBands(ratioSeries) {
  const values = ratioSeries.map((p) => p.ratio);
  const m = mean(values);
  const sd = stdDev(values);
  if (m === null || sd === null) return null;
  return {
    mean: m,
    stdDev: sd,
    upper1: m + sd,
    lower1: m - sd,
    upper2: m + 2 * sd,
    lower2: m - 2 * sd
  };
}

/**
 * 3:2:1 crack spread ($/bbl): the refiner margin for cracking 3 barrels of
 * WTI into 2 barrels of gasoline and 1 barrel of heating oil (diesel proxy).
 * Gasoline/heating oil quotes are in $/gallon (as Alpha Vantage and EIA
 * report them) and are converted to $/bbl using the 42 gal/bbl constant
 * before netting against WTI.
 *
 * Returns null when refined product prices aren't available — callers
 * should fall back to a WTI-only note rather than guessing.
 */
export function crackSpread321(wtiPricePerBbl, gasolinePricePerGal, heatingOilPricePerGal) {
  if (!wtiPricePerBbl || !gasolinePricePerGal || !heatingOilPricePerGal) return null;
  const productRevenue = 2 * gasolinePricePerGal * 42 + 1 * heatingOilPricePerGal * 42;
  const feedstockCost = 3 * wtiPricePerBbl;
  return (productRevenue - feedstockCost) / 3;
}

/**
 * Contango/backwardation regime from near-month vs far-month futures
 * prices. Contango: far > near (storage/carry favored, bearish spot
 * fundamentals). Backwardation: near > far (tight prompt supply, bullish
 * spot fundamentals). A tiny neutral band absorbs noise around flat curves.
 */
export function futuresRegime(nearPrice, farPrice, neutralBandPct = 0.001) {
  if (!nearPrice || !farPrice) return null;
  const spread = farPrice - nearPrice;
  const band = nearPrice * neutralBandPct;
  if (Math.abs(spread) <= band) return { label: 'NEUTRAL', spread };
  return { label: spread > 0 ? 'CONTANGO' : 'BACKWARDATION', spread };
}

/** Percent change from a reference price to the current price. */
export function percentChange(current, reference) {
  if (!current || !reference) return null;
  return ((current - reference) / reference) * 100;
}

/**
 * Mark-to-market P&L for an open or closed paper trade. Contract
 * multipliers live in one place (instruments.js TRADE_INSTRUMENTS) so a
 * WTI outright is always valued in 1,000-bbl contract terms and a
 * synthetic multi-leg observation (ratio/crack) is always valued in flat
 * notional terms — never mixed up.
 *
 * `direction` is 'Long' or 'Short'. `size` is in the instrument's sizeUnit
 * (contracts for outrights, $ notional per point for synthetic positions).
 */
export function calculatePnL({ instrument, direction, entryPrice, size, exitPrice = null }, currentPrice) {
  const markPrice = exitPrice ?? currentPrice;
  if (markPrice === null || markPrice === undefined || !entryPrice) return null;
  const multiplier = TRADE_INSTRUMENTS[instrument]?.multiplier ?? 1;
  const dirSign = direction === 'Short' ? -1 : 1;
  return (markPrice - entryPrice) * dirSign * size * multiplier;
}

/**
 * Minimum viable trade input: a recognized instrument, a positive entry
 * price, and a non-zero size. Extracted as a pure function (rather than
 * left inline in the form's submit handler) so the trade-log's core
 * validation guard is unit-testable without rendering the component.
 */
export function isValidTradeInput({ instrument, entryPrice, size }) {
  return Boolean(TRADE_INSTRUMENTS[instrument] && entryPrice > 0 && size !== 0 && !Number.isNaN(size));
}

/**
 * Pre-trade risk/reward preview from entry/stop/target — shown before a
 * trade is logged so risk is sized deliberately, not discovered later.
 * Returns null fields where inputs are missing rather than guessing.
 */
export function calculateRiskReward({ instrument, direction, entryPrice, size, stopPrice, targetPrice }) {
  const multiplier = TRADE_INSTRUMENTS[instrument]?.multiplier ?? 1;
  const dirSign = direction === 'Short' ? -1 : 1;

  const maxRisk =
    entryPrice && stopPrice && size ? Math.abs(entryPrice - stopPrice) * size * multiplier : null;
  const estReward =
    entryPrice && targetPrice && size ? Math.abs(targetPrice - entryPrice) * size * multiplier : null;

  // Sanity-check that stop/target sit on the correct side of entry for the
  // chosen direction (e.g. a Long's stop should be below entry) — if not,
  // don't fabricate a ratio from an internally inconsistent setup.
  const stopValid = !stopPrice || dirSign * (entryPrice - stopPrice) > 0;
  const targetValid = !targetPrice || dirSign * (targetPrice - entryPrice) > 0;

  return {
    maxRisk,
    estReward,
    riskRewardRatio: maxRisk && estReward ? estReward / maxRisk : null,
    stopValid,
    targetValid
  };
}

/** Profit factor: gross winnings / gross losses. >1 means winners outweigh losers in dollar terms. */
export function profitFactor(pnls) {
  const grossWin = pnls.filter((p) => p > 0).reduce((sum, p) => sum + p, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((sum, p) => sum + p, 0));
  if (grossLoss === 0) return grossWin > 0 ? Infinity : null;
  return grossWin / grossLoss;
}

/** Expectancy: average $ P&L per trade, blending win rate with average win/loss size. */
export function expectancy(pnls) {
  return pnls.length ? mean(pnls) : null;
}

/**
 * Builds a "current year vs prior-years average/range" seasonal comparison
 * from a weekly date series (e.g. EIA crude inventory or natural gas
 * storage). This is the classic chart traders use to see whether stocks
 * are unusually high or low for the time of year, not just vs last week.
 *
 * Buckets each observation into a 1-52 week-of-year index (days 365/366
 * of a year — the rare "week 53" — fold into bucket 52 rather than create
 * a near-empty 53rd bucket almost no other year has data for), averages
 * all non-current years per bucket, and returns one row per week with the
 * current year's value plus the historical mean/min/max (when history
 * exists for that week — a missing week in some years just yields a
 * shorter history array, not a fabricated zero).
 */
export function seasonalAverageByWeek(series) {
  if (!series || series.length === 0) return [];

  // Dates come in as plain "YYYY-MM-DD" strings, which JS parses as UTC
  // midnight. Extracting the year/month with the *local* getFullYear()
  // instead of getUTCFullYear() would shift any date near Jan 1 to the
  // wrong year in timezones behind UTC (most of the Americas), corrupting
  // both which year a point belongs to and which week-of-year bucket it
  // lands in. Everything below stays in UTC to avoid that.
  const currentYear = new Date(series[series.length - 1].date).getUTCFullYear();
  const buckets = new Map(); // weekOfYear -> { current: number|null, history: number[] }

  for (const point of series) {
    const date = new Date(point.date);
    const year = date.getUTCFullYear();
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const dayOfYear = Math.floor((date - startOfYear) / 86400000);
    const weekOfYear = Math.min(52, Math.floor(dayOfYear / 7) + 1);

    if (!buckets.has(weekOfYear)) buckets.set(weekOfYear, { current: null, history: [] });
    const bucket = buckets.get(weekOfYear);
    if (year === currentYear) bucket.current = point.value;
    else bucket.history.push(point.value);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekOfYear, bucket]) => ({
      weekOfYear,
      current: bucket.current,
      seasonalAvg: bucket.history.length ? mean(bucket.history) : null,
      seasonalMin: bucket.history.length ? Math.min(...bucket.history) : null,
      seasonalMax: bucket.history.length ? Math.max(...bucket.history) : null
    }));
}

/** Aggregate stats (realized P&L, win rate, avg winner/loser, profit factor, expectancy) over closed trades. */
export function summarizeClosedTrades(closedTrades) {
  if (!closedTrades || closedTrades.length === 0) {
    return {
      totalRealizedPnl: 0,
      winRate: null,
      avgWinner: null,
      avgLoser: null,
      profitFactor: null,
      expectancy: null,
      count: 0
    };
  }
  const pnls = closedTrades.map((t) => calculatePnL(t, null)).filter((p) => p !== null);
  const winners = pnls.filter((p) => p > 0);
  const losers = pnls.filter((p) => p <= 0);
  return {
    totalRealizedPnl: pnls.reduce((sum, p) => sum + p, 0),
    winRate: pnls.length ? (winners.length / pnls.length) * 100 : null,
    avgWinner: winners.length ? mean(winners) : null,
    avgLoser: losers.length ? mean(losers) : null,
    profitFactor: pnls.length ? profitFactor(pnls) : null,
    expectancy: pnls.length ? expectancy(pnls) : null,
    count: pnls.length
  };
}
