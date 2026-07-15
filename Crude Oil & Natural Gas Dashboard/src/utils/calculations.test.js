import { describe, it, expect } from 'vitest';
import {
  mean,
  stdDev,
  zScore,
  percentileRank,
  oilGasRatio,
  buildRatioSeries,
  alignSeriesByDate,
  ratioBands,
  crackSpread321,
  futuresRegime,
  calculatePnL,
  calculateRiskReward,
  isValidTradeInput,
  summarizeClosedTrades,
  seasonalAverageByWeek
} from './calculations.js';

describe('mean / stdDev', () => {
  it('computes arithmetic mean', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns null for empty input', () => {
    expect(mean([])).toBeNull();
    expect(stdDev([])).toBeNull();
  });

  it('returns null stdDev for a single observation (n-1 denominator undefined)', () => {
    expect(stdDev([5])).toBeNull();
  });

  it('returns zero stdDev for identical values, not a divide-by-zero artifact', () => {
    expect(stdDev([10, 10, 10])).toBe(0);
  });
});

describe('zScore', () => {
  it('is null when the series has zero standard deviation (no divide-by-zero NaN/Infinity)', () => {
    expect(zScore(10, [10, 10, 10])).toBeNull();
  });

  it('is null for an empty series', () => {
    expect(zScore(10, [])).toBeNull();
  });

  it('computes a standard z-score', () => {
    // series mean=10, stdDev=sqrt(((8-10)^2+(10-10)^2+(12-10)^2)/2)=2
    const series = [8, 10, 12];
    expect(zScore(12, series)).toBeCloseTo(1, 5);
    expect(zScore(8, series)).toBeCloseTo(-1, 5);
  });
});

describe('percentileRank', () => {
  it('returns 100 when value is the max of the series', () => {
    expect(percentileRank(5, [1, 2, 3, 4, 5])).toBe(100);
  });

  it('returns 0 share (only itself counts) when value is the min', () => {
    expect(percentileRank(1, [1, 2, 3, 4, 5])).toBe(20);
  });

  it('returns null for an empty series or missing value', () => {
    expect(percentileRank(5, [])).toBeNull();
    expect(percentileRank(null, [1, 2, 3])).toBeNull();
  });
});

describe('oilGasRatio', () => {
  it('divides WTI by Henry Hub', () => {
    expect(oilGasRatio(70, 3.5)).toBe(20);
  });

  it('returns null for missing/zero inputs rather than Infinity or NaN', () => {
    expect(oilGasRatio(null, 3.5)).toBeNull();
    expect(oilGasRatio(70, 0)).toBeNull();
    expect(oilGasRatio(70, null)).toBeNull();
  });
});

describe('buildRatioSeries (date alignment)', () => {
  it('inner-joins on shared dates only, dropping unmatched observations', () => {
    const wti = [
      { date: '2026-01-01', value: 70 },
      { date: '2026-01-02', value: 71 },
      { date: '2026-01-03', value: 72 } // no matching HH date
    ];
    const hh = [
      { date: '2026-01-01', value: 3.5 },
      { date: '2026-01-02', value: 3.6 }
    ];
    const result = buildRatioSeries(wti, hh);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.date)).toEqual(['2026-01-01', '2026-01-02']);
    expect(result[0].ratio).toBeCloseTo(20, 5);
  });

  it('returns an empty array when there are no overlapping dates at all', () => {
    const wti = [{ date: '2026-01-01', value: 70 }];
    const hh = [{ date: '2026-02-01', value: 3.5 }];
    expect(buildRatioSeries(wti, hh)).toEqual([]);
  });

  it('sorts ascending by date regardless of input order', () => {
    const wti = [
      { date: '2026-01-03', value: 72 },
      { date: '2026-01-01', value: 70 }
    ];
    const hh = [
      { date: '2026-01-03', value: 3.7 },
      { date: '2026-01-01', value: 3.5 }
    ];
    const result = buildRatioSeries(wti, hh);
    expect(result.map((r) => r.date)).toEqual(['2026-01-01', '2026-01-03']);
  });
});

describe('alignSeriesByDate (N-way date alignment)', () => {
  it('only keeps dates present in every series', () => {
    const a = [{ date: '2026-01-01', value: 1 }, { date: '2026-01-02', value: 2 }];
    const b = [{ date: '2026-01-01', value: 10 }, { date: '2026-01-02', value: 20 }];
    const c = [{ date: '2026-01-01', value: 100 }]; // missing 01-02
    const result = alignSeriesByDate({ a, b, c });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: '2026-01-01', values: { a: 1, b: 10, c: 100 } });
  });

  it('returns an empty array for no overlapping dates', () => {
    const a = [{ date: '2026-01-01', value: 1 }];
    const b = [{ date: '2026-01-02', value: 2 }];
    expect(alignSeriesByDate({ a, b })).toEqual([]);
  });
});

describe('ratioBands', () => {
  it('computes mean and +/-1/2 sigma bands', () => {
    const series = [{ ratio: 18 }, { ratio: 20 }, { ratio: 22 }];
    const bands = ratioBands(series);
    expect(bands.mean).toBe(20);
    expect(bands.stdDev).toBeCloseTo(2, 5);
    expect(bands.upper1).toBeCloseTo(22, 5);
    expect(bands.lower1).toBeCloseTo(18, 5);
    expect(bands.upper2).toBeCloseTo(24, 5);
    expect(bands.lower2).toBeCloseTo(16, 5);
  });

  it('returns null when fewer than 2 points (stdDev undefined)', () => {
    expect(ratioBands([{ ratio: 20 }])).toBeNull();
  });
});

describe('crackSpread321', () => {
  it('computes the 3:2:1 crack spread from spot legs', () => {
    // (2*3*42 + 1*3.2*42 - 3*70) / 3
    const expected = (2 * 3 * 42 + 1 * 3.2 * 42 - 3 * 70) / 3;
    expect(crackSpread321(70, 3, 3.2)).toBeCloseTo(expected, 5);
  });

  it('returns null if any leg is missing', () => {
    expect(crackSpread321(null, 3, 3.2)).toBeNull();
    expect(crackSpread321(70, null, 3.2)).toBeNull();
    expect(crackSpread321(70, 3, null)).toBeNull();
  });
});

describe('futuresRegime', () => {
  it('detects contango (far > near)', () => {
    expect(futuresRegime(70, 72).label).toBe('CONTANGO');
  });

  it('detects backwardation (near > far)', () => {
    expect(futuresRegime(72, 70).label).toBe('BACKWARDATION');
  });

  it('detects neutral within the noise band', () => {
    expect(futuresRegime(70, 70.001).label).toBe('NEUTRAL');
  });
});

describe('calculatePnL — long and short, contract multipliers', () => {
  it('computes long WTI P&L using the 1,000 bbl contract multiplier', () => {
    const trade = { instrument: 'WTI Crude', direction: 'Long', entryPrice: 70, size: 2 };
    expect(calculatePnL(trade, 71)).toBe((71 - 70) * 2 * 1000);
  });

  it('computes short WTI P&L with the sign flipped vs long', () => {
    const trade = { instrument: 'WTI Crude', direction: 'Short', entryPrice: 70, size: 2 };
    expect(calculatePnL(trade, 71)).toBe(-(71 - 70) * 2 * 1000);
  });

  it('uses the Henry Hub 10,000 MMBtu multiplier, not the WTI one', () => {
    const trade = { instrument: 'Henry Hub', direction: 'Long', entryPrice: 3.5, size: 1 };
    expect(calculatePnL(trade, 3.6)).toBeCloseTo((3.6 - 3.5) * 1 * 10000, 5);
  });

  it('uses a flat notional multiplier (1) for the synthetic Oil-to-Gas Ratio instrument', () => {
    const trade = { instrument: 'Oil-to-Gas Ratio', direction: 'Long', entryPrice: 20, size: 500 };
    expect(calculatePnL(trade, 21)).toBe((21 - 20) * 500 * 1);
  });

  it('prefers exitPrice over currentPrice once a trade is closed', () => {
    const trade = { instrument: 'WTI Crude', direction: 'Long', entryPrice: 70, size: 1, exitPrice: 75 };
    expect(calculatePnL(trade, 9999)).toBe((75 - 70) * 1 * 1000);
  });

  it('returns null when there is no mark price available (missing latest value)', () => {
    const trade = { instrument: 'WTI Crude', direction: 'Long', entryPrice: 70, size: 1 };
    expect(calculatePnL(trade, null)).toBeNull();
    expect(calculatePnL(trade, undefined)).toBeNull();
  });

  it('returns null when entryPrice itself is falsy/missing', () => {
    const trade = { instrument: 'WTI Crude', direction: 'Long', entryPrice: 0, size: 1 };
    expect(calculatePnL(trade, 70)).toBeNull();
  });
});

describe('calculateRiskReward', () => {
  it('computes max risk, est reward, and R:R for a valid long setup', () => {
    const result = calculateRiskReward({ instrument: 'WTI Crude', direction: 'Long', entryPrice: 70, size: 2, stopPrice: 68, targetPrice: 76 });
    expect(result.maxRisk).toBe(4000);
    expect(result.estReward).toBe(12000);
    expect(result.riskRewardRatio).toBeCloseTo(3, 5);
    expect(result.stopValid).toBe(true);
    expect(result.targetValid).toBe(true);
  });

  it('flags an inverted stop/target for a long (stop above entry is wrong-sided)', () => {
    const result = calculateRiskReward({ instrument: 'WTI Crude', direction: 'Long', entryPrice: 70, size: 1, stopPrice: 72, targetPrice: 76 });
    expect(result.stopValid).toBe(false);
  });

  it('flags an inverted stop/target for a short (stop below entry is wrong-sided)', () => {
    const result = calculateRiskReward({ instrument: 'WTI Crude', direction: 'Short', entryPrice: 70, size: 1, stopPrice: 68, targetPrice: 65 });
    expect(result.stopValid).toBe(false);
  });

  it('returns null risk/reward fields when stop or target is omitted', () => {
    const result = calculateRiskReward({ instrument: 'WTI Crude', direction: 'Long', entryPrice: 70, size: 1, stopPrice: null, targetPrice: null });
    expect(result.maxRisk).toBeNull();
    expect(result.estReward).toBeNull();
    expect(result.riskRewardRatio).toBeNull();
  });
});

describe('isValidTradeInput (trade-form validation)', () => {
  it('accepts a well-formed trade', () => {
    expect(isValidTradeInput({ instrument: 'WTI Crude', entryPrice: 70, size: 2 })).toBe(true);
  });

  it('rejects an unrecognized instrument', () => {
    expect(isValidTradeInput({ instrument: 'Not A Real Instrument', entryPrice: 70, size: 2 })).toBe(false);
  });

  it('rejects a zero or negative entry price', () => {
    expect(isValidTradeInput({ instrument: 'WTI Crude', entryPrice: 0, size: 2 })).toBe(false);
    expect(isValidTradeInput({ instrument: 'WTI Crude', entryPrice: -5, size: 2 })).toBe(false);
  });

  it('rejects a zero or NaN size', () => {
    expect(isValidTradeInput({ instrument: 'WTI Crude', entryPrice: 70, size: 0 })).toBe(false);
    expect(isValidTradeInput({ instrument: 'WTI Crude', entryPrice: 70, size: NaN })).toBe(false);
  });
});

describe('summarizeClosedTrades', () => {
  it('aggregates realized P&L, win rate, avg winner/loser, profit factor, expectancy', () => {
    const closed = [
      { instrument: 'WTI Crude', direction: 'Long', entryPrice: 70, size: 1, exitPrice: 75 }, // +5000
      { instrument: 'WTI Crude', direction: 'Long', entryPrice: 70, size: 1, exitPrice: 68 } // -2000
    ];
    const summary = summarizeClosedTrades(closed);
    expect(summary.totalRealizedPnl).toBe(3000);
    expect(summary.winRate).toBe(50);
    expect(summary.avgWinner).toBe(5000);
    expect(summary.avgLoser).toBe(-2000);
    expect(summary.profitFactor).toBeCloseTo(2.5, 5);
    expect(summary.expectancy).toBe(1500);
  });

  it('returns a clean zeroed-out summary for no closed trades', () => {
    const summary = summarizeClosedTrades([]);
    expect(summary.totalRealizedPnl).toBe(0);
    expect(summary.winRate).toBeNull();
    expect(summary.profitFactor).toBeNull();
  });
});

describe('seasonalAverageByWeek', () => {
  it('separates the current year from prior-year history per week bucket', () => {
    const series = [
      { date: '2024-01-03', value: 100 },
      { date: '2025-01-02', value: 110 },
      { date: '2026-01-01', value: 120 } // current year (latest date in series)
    ];
    const result = seasonalAverageByWeek(series);
    const week1 = result.find((r) => r.weekOfYear === 1);
    expect(week1.current).toBe(120);
    expect(week1.seasonalAvg).toBeCloseTo(105, 5);
    expect(week1.seasonalMin).toBe(100);
    expect(week1.seasonalMax).toBe(110);
  });

  it('returns an empty array for an empty series', () => {
    expect(seasonalAverageByWeek([])).toEqual([]);
  });
});
