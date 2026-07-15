import { useMemo, useState } from 'react';
import { useWtiFuturesNear, useWtiFuturesFar } from '../hooks/useEIAData.js';
import { useOilGasRatioSeries, useCrackSpreadSeries } from '../hooks/useDerivedMarketData.js';
import SpreadBandChart from './SpreadBandChart.jsx';
import { ratioBands, futuresRegime, zScore, percentileRank } from '../utils/calculations.js';
import { formatNumber, formatCurrency, formatDate, formatSigma } from '../utils/formatters.js';
import { getContractInfo } from '../utils/futuresContracts.js';
import { INSTRUMENTS } from '../utils/instruments.js';

const REGIME_STYLES = {
  CONTANGO: 'text-signal border-signal/40 bg-signal/10',
  BACKWARDATION: 'text-bull border-bull/40 bg-bull/10',
  NEUTRAL: 'text-terminal-muted border-terminal-border bg-zinc-900'
};

const WINDOWS = { '90D': 90, '1Y': 365 };

export default function SpreadSignals() {
  const near = useWtiFuturesNear();
  const far = useWtiFuturesFar();
  const { series: fullRatioSeries, isLoading: ratioLoading, isError: ratioError } = useOilGasRatioSeries();
  const { series: crackSeries, aligned: crackAligned, isError: crackUnavailable } = useCrackSpreadSeries();
  const [rangeWindow, setWindowRange] = useState('90D');

  const ratioWindowed = useMemo(() => fullRatioSeries.slice(-WINDOWS[rangeWindow]), [fullRatioSeries, rangeWindow]);
  const bandsWindowed = useMemo(() => ratioBands(ratioWindowed), [ratioWindowed]);
  const latestRatioPoint = ratioWindowed.length ? ratioWindowed[ratioWindowed.length - 1] : null;
  const windowedZ = useMemo(
    () => (latestRatioPoint ? zScore(latestRatioPoint.ratio, ratioWindowed.map((p) => p.ratio)) : null),
    [latestRatioPoint, ratioWindowed]
  );
  const windowedPercentile = useMemo(
    () => (latestRatioPoint ? percentileRank(latestRatioPoint.ratio, ratioWindowed.map((p) => p.ratio)) : null),
    [latestRatioPoint, ratioWindowed]
  );

  const crackLatestRow = crackAligned.length ? crackAligned[crackAligned.length - 1] : null;
  const wtiLatest = crackLatestRow?.values.wti ?? null;
  const gasolineLatest = crackLatestRow?.values.gasoline ?? null;
  const heatingOilLatest = crackLatestRow?.values.heatingOil ?? null;
  const crack = crackSeries.length ? crackSeries[crackSeries.length - 1].value : null;

  const nearLatest = near.data?.[near.data.length - 1];
  const farLatest = far.data?.[far.data.length - 1];
  const regime = nearLatest && farLatest ? futuresRegime(nearLatest.value, farLatest.value) : null;

  // EIA discontinued its entire futures-curve dataset after 2024-04-05 (see
  // instruments.js — confirmed against the dataset's own endPeriod
  // metadata). The near/far values above are real, but they are not current
  // — this card must never present them beside today's spot prices as
  // though they were comparable live data.
  const futuresDiscontinued = Boolean(INSTRUMENTS.wtiFutContract1.discontinuedAfter);
  const nearContract = nearLatest ? getContractInfo(nearLatest.date, 1) : null;
  const farContract = farLatest ? getContractInfo(farLatest.date, 4) : null;

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header">
          <span>OIL-TO-GAS RATIO ({rangeWindow}, WTI &amp; HH DATE-ALIGNED)</span>
          <div className="flex items-center gap-2">
            {latestRatioPoint && (
              <span className="text-terminal-muted text-[11px]">as of {formatDate(latestRatioPoint.date)}</span>
            )}
            <div className="flex gap-0.5">
              {Object.keys(WINDOWS).map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowRange(w)}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    rangeWindow === w ? 'bg-zinc-700 text-white' : 'text-terminal-muted hover:text-terminal-text'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-3">
          <SpreadBandChart
            ratioSeries={ratioWindowed}
            bands={bandsWindowed}
            height={280}
            isLoading={ratioLoading}
            isError={ratioError}
          />
        </div>
        {bandsWindowed && (
          <div className="px-3 pb-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {[
              ['-2σ', bandsWindowed.lower2],
              ['-1σ', bandsWindowed.lower1],
              ['μ', bandsWindowed.mean],
              ['+1σ', bandsWindowed.upper1],
              ['+2σ', bandsWindowed.upper2]
            ].map(([label, val]) => (
              <div key={label} className="border border-terminal-border rounded py-1">
                <div className="stat-label">{label}</div>
                <div className="tabular text-sm">{formatNumber(val)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="px-3 pb-3 pt-2 flex flex-wrap gap-4 text-[11px] text-terminal-muted">
          <span>
            Current z-score: <span className="text-terminal-text tabular">{formatSigma(windowedZ)}</span>
          </span>
          <span>
            Percentile ({rangeWindow}): <span className="text-terminal-text tabular">{windowedPercentile !== null ? `${windowedPercentile.toFixed(0)}th` : '—'}</span>
          </span>
          <span>μ and σ bands are calculated over the currently selected {rangeWindow} window, not a rolling lookback — switching windows recomputes them.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header">
            <span>INDICATIVE SPOT 3:2:1 CRACK PROXY</span>
          </div>
          <div className="p-4">
            {crack !== null ? (
              <>
                <div className="text-2xl font-semibold tabular">{formatCurrency(crack)}/bbl of crude</div>
                <div className="text-[11px] text-terminal-muted mt-2 leading-snug">
                  WTI {formatCurrency(wtiLatest)} · Gasoline {formatCurrency(gasolineLatest, { decimals: 3 })}/gal ·
                  Heating Oil {formatCurrency(heatingOilLatest, { decimals: 3 })}/gal (NY Harbor spot, via EIA) — all
                  as of {formatDate(crackLatestRow.date)}
                </div>
                <p className="text-[11px] text-terminal-muted mt-2 leading-snug border-t border-terminal-border pt-2">
                  This is an <strong className="text-terminal-text">indicative spot proxy</strong>, built from spot
                  prices, not tradeable refinery margins. It excludes refinery operating costs, actual refinery
                  yields (real refineries don't produce a fixed 2:1 gasoline:distillate ratio), transportation,
                  quality/location basis, financing, and execution/hedging costs.
                </p>
              </>
            ) : crackUnavailable ? (
              <div className="text-lg text-bear">Failed to load gasoline/heating oil data</div>
            ) : (
              <div className="h-12 w-full rounded bg-zinc-900 animate-pulse" />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>WTI FUTURES CURVE SHAPE</span>
            {futuresDiscontinued && (
              <span className="text-bear text-[10px] border border-bear/40 rounded px-1">HISTORICAL</span>
            )}
          </div>
          <div className="p-4">
            {regime ? (
              <>
                {futuresDiscontinued && (
                  <div className="mb-3 text-xs text-bear border border-bear/40 bg-bear/10 rounded px-2 py-1.5 leading-snug">
                    HISTORICAL — EIA data unavailable after April 5, 2024. These are real historical quotes, not a
                    current market read, and are <strong>not comparable</strong> to today's WTI spot price shown
                    elsewhere on this dashboard. Shown for educational curve-shape analysis only.
                  </div>
                )}
                <span className={`inline-block px-3 py-1 rounded border text-lg font-semibold tracking-wide ${REGIME_STYLES[regime.label]}`}>
                  {regime.label}
                </span>
                <div className="mt-3 text-sm text-terminal-muted">
                  {nearContract?.ticker} ({nearContract?.label}):{' '}
                  <span className="text-terminal-text tabular">{formatCurrency(nearLatest.value)}</span> vs{' '}
                  {farContract?.ticker} ({farContract?.label}):{' '}
                  <span className="text-terminal-text tabular">{formatCurrency(farLatest.value)}</span>
                </div>
                <div className="text-[11px] text-terminal-muted mt-1">
                  Quotes as of {formatDate(nearLatest.date)} — continuous front-month/4th-month futures, EIA series{' '}
                  {INSTRUMENTS.wtiFutContract1.seriesId} / {INSTRUMENTS.wtiFutContract4.seriesId}.
                </div>
                <p className="text-[11px] text-terminal-muted mt-2 leading-snug">
                  {regime.label === 'CONTANGO' &&
                    'As of that date, far-month WTI traded above the near month — consistent with ample near-term supply at the time.'}
                  {regime.label === 'BACKWARDATION' &&
                    'As of that date, near-month WTI traded above the far month — consistent with tight prompt supply at the time.'}
                  {regime.label === 'NEUTRAL' &&
                    'As of that date, near and far month prices were essentially flat.'}
                </p>
                <p className="text-[11px] text-terminal-muted mt-2 leading-snug">
                  No current free, no-credential provider of the live WTI futures curve was available at build
                  time. Adding one would require documenting the provider, coverage, cost, credential requirements,
                  and licensing restrictions before wiring it in — see README.
                </p>
              </>
            ) : (
              <div className="text-sm text-terminal-muted">
                {near.isLoading || far.isLoading ? 'Loading futures curve…' : 'EIA futures curve data unavailable.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
