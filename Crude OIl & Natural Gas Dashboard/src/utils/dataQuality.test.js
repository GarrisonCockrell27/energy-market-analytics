import { describe, it, expect } from 'vitest';
import { checkSeries, describeQueryHealth, summarizeHealth, STATUS } from './dataQuality.js';

const FIXED_NOW = new Date('2026-07-14T00:00:00Z').getTime();
const dailyMeta = { frequency: 'daily', unit: '$/bbl', plausibleRange: [-50, 300] };
const weeklyMeta = { frequency: 'weekly', unit: 'kbbl' };

describe('checkSeries', () => {
  it('flags an empty series as having no data and being stale', () => {
    const result = checkSeries([], dailyMeta, { now: FIXED_NOW });
    expect(result.lastObservationDate).toBeNull();
    expect(result.isStale).toBe(true);
    expect(result.extremeJumps).toEqual([]);
  });

  it('flags duplicate observation dates', () => {
    const series = [
      { date: '2026-07-01', value: 70 },
      { date: '2026-07-01', value: 71 }
    ];
    const result = checkSeries(series, dailyMeta, { now: FIXED_NOW });
    expect(result.warnings.some((w) => w.message.includes('Duplicate observation date'))).toBe(true);
  });

  it('flags non-monotonic dates', () => {
    const series = [
      { date: '2026-07-02', value: 71 },
      { date: '2026-07-01', value: 70 }
    ];
    const result = checkSeries(series, dailyMeta, { now: FIXED_NOW });
    expect(result.warnings.some((w) => w.message.includes('not monotonically increasing'))).toBe(true);
  });

  it('flags a value outside the instrument-defined plausible range', () => {
    const series = [{ date: '2026-07-01', value: 9999 }];
    const result = checkSeries(series, dailyMeta, { now: FIXED_NOW });
    expect(result.warnings.some((w) => w.message.includes('outside the plausible range'))).toBe(true);
  });

  it('detects an extreme one-day jump on a daily series', () => {
    const series = [
      { date: '2026-07-01', value: 3.3 },
      { date: '2026-07-02', value: 8.4 } // +155%, well past the 40% threshold
    ];
    const result = checkSeries(series, dailyMeta, { now: FIXED_NOW });
    expect(result.extremeJumps).toHaveLength(1);
    expect(result.extremeJumps[0].date).toBe('2026-07-02');
  });

  it('does not flag ordinary day-to-day moves as extreme jumps', () => {
    const series = [
      { date: '2026-07-01', value: 70 },
      { date: '2026-07-02', value: 71 }
    ];
    const result = checkSeries(series, dailyMeta, { now: FIXED_NOW });
    expect(result.extremeJumps).toEqual([]);
  });

  it('never flags jumps for weekly series (structural moves would false-positive constantly)', () => {
    const series = [
      { date: '2026-06-01', value: 100 },
      { date: '2026-06-08', value: 500 } // huge % move, but weekly frequency
    ];
    const result = checkSeries(series, weeklyMeta, { now: FIXED_NOW });
    expect(result.extremeJumps).toEqual([]);
  });

  it('classifies a recent daily observation as not stale', () => {
    const series = [{ date: '2026-07-12', value: 70 }]; // 2 days before FIXED_NOW
    const result = checkSeries(series, dailyMeta, { now: FIXED_NOW });
    expect(result.isStale).toBe(false);
  });

  it('classifies an old daily observation as stale', () => {
    const series = [{ date: '2026-06-01', value: 70 }]; // over a month old
    const result = checkSeries(series, dailyMeta, { now: FIXED_NOW });
    expect(result.isStale).toBe(true);
  });
});

describe('describeQueryHealth', () => {
  const coreMeta = { name: 'WTI Cushing Spot', source: 'EIA', tier: 'core', frequency: 'daily', unit: '$/bbl' };
  const historicalMeta = { name: 'WTI Futures Front Month', source: 'EIA', tier: 'historical', frequency: 'daily', discontinuedAfter: '2024-04-05' };
  const optionalMeta = { name: 'WTI (Alpha Vantage)', source: 'Alpha Vantage', tier: 'optional', requiresKey: 'alphaVantage', requiresKeyEnvVar: 'ALPHA_VANTAGE_API_KEY', frequency: 'daily' };

  it('classifies an optional integration with a missing key as NOT_CONFIGURED, never FAILED', () => {
    const query = { data: undefined, isError: true, isFetching: false, dataUpdatedAt: 0 };
    const result = describeQueryHealth('avWti', optionalMeta, query, { alphaVantage: false });
    expect(result.status).toBe(STATUS.NOT_CONFIGURED);
  });

  it('classifies a discontinued source as HISTORICAL even when the query itself succeeded', () => {
    const query = { data: [{ date: '2024-04-05', value: 85 }], isError: false, isFetching: false, dataUpdatedAt: Date.now() };
    const result = describeQueryHealth('wtiFutContract1', historicalMeta, query, {});
    expect(result.status).toBe(STATUS.HISTORICAL);
  });

  it('classifies a core source with no data and a failed request as FAILED', () => {
    const query = { data: undefined, isError: true, isFetching: false, dataUpdatedAt: 0 };
    const result = describeQueryHealth('wtiSpot', coreMeta, query, {});
    expect(result.status).toBe(STATUS.FAILED);
  });

  it('classifies a core source with no data and no error as UNAVAILABLE, not FAILED', () => {
    const query = { data: undefined, isError: false, isFetching: true, dataUpdatedAt: 0 };
    const result = describeQueryHealth('wtiSpot', coreMeta, query, {});
    expect(result.status).toBe(STATUS.UNAVAILABLE);
  });

  it('classifies a source with cached data but a failed refresh as STALE, and says so honestly', () => {
    const query = { data: [{ date: '2026-07-01', value: 70 }], isError: true, isFetching: false, dataUpdatedAt: 1000 };
    const result = describeQueryHealth('wtiSpot', coreMeta, query, {});
    expect(result.status).toBe(STATUS.STALE);
    expect(result.warnings.some((w) => w.message.includes('Refresh failed'))).toBe(true);
  });

  it('classifies fresh, successful data as CURRENT', () => {
    const recentDate = new Date().toISOString().slice(0, 10);
    const query = { data: [{ date: recentDate, value: 70 }], isError: false, isFetching: false, dataUpdatedAt: Date.now() };
    const result = describeQueryHealth('wtiSpot', coreMeta, query, {});
    expect(result.status).toBe(STATUS.CURRENT);
  });
});

describe('summarizeHealth', () => {
  it('produces the "X/Y core current · N historical · M optional not configured" summary', () => {
    const records = [
      { tier: 'core', status: STATUS.CURRENT, source: 'EIA' },
      { tier: 'core', status: STATUS.CURRENT, source: 'EIA' },
      { tier: 'core', status: STATUS.STALE, source: 'EIA' },
      { tier: 'historical', status: STATUS.HISTORICAL, source: 'EIA' },
      { tier: 'historical', status: STATUS.HISTORICAL, source: 'EIA' },
      { tier: 'optional', status: STATUS.NOT_CONFIGURED, source: 'Alpha Vantage' },
      { tier: 'optional', status: STATUS.NOT_CONFIGURED, source: 'Alpha Vantage' },
      { tier: 'optional', status: STATUS.NOT_CONFIGURED, source: 'FRED' }
    ];
    const { summary, healthy, coreCurrent, coreTotal } = summarizeHealth(records);
    expect(coreCurrent).toBe(2);
    expect(coreTotal).toBe(3);
    expect(healthy).toBe(false); // one core source is STALE
    expect(summary).toContain('2/3 core data sources current');
    expect(summary).toContain('2 historical datasets');
    expect(summary).toContain('2 optional integrations not configured'); // 2 distinct providers: Alpha Vantage, FRED
  });

  it('reports healthy when every core source is current', () => {
    const records = [
      { tier: 'core', status: STATUS.CURRENT, source: 'EIA' },
      { tier: 'core', status: STATUS.CURRENT, source: 'EIA' }
    ];
    expect(summarizeHealth(records).healthy).toBe(true);
  });
});
