import { useMemo } from 'react';
import { useWtiSpot, useHenryHubSpot, useCrudeInventory, useCushingInventory } from '../hooks/useEIAData.js';
import { useOilGasRatioSeries } from '../hooks/useDerivedMarketData.js';
import { useAvWti, useAvNaturalGas } from '../hooks/useAlphaVantage.js';
import { useDxy, useTenYearYield } from '../hooks/useFRED.js';
import PriceChart from './PriceChart.jsx';
import SpreadBandChart from './SpreadBandChart.jsx';
import DataHealth from './DataHealth.jsx';
import { ratioBands, zScore, percentileRank } from '../utils/calculations.js';
import { formatNumber, formatSigma, formatCompactNumber, formatDate, formatPercent, signColor } from '../utils/formatters.js';
import { INSTRUMENTS } from '../utils/instruments.js';

function MacroTile({ label, value, change, unit = '', decimals = 2, isLoading, isError }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2 border-r border-terminal-border last:border-r-0">
      <span className="stat-label">{label}</span>
      {isLoading ? (
        <div className="h-5 w-16 bg-zinc-800 rounded animate-pulse" />
      ) : isError ? (
        <span className="text-xs text-terminal-muted">NOT CONFIGURED</span>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="tabular font-semibold">
            {value !== null ? formatNumber(value, { decimals }) : '—'}
            {unit}
          </span>
          <span className={`text-xs tabular ${signColor(change)}`}>{formatPercent(change)}</span>
        </div>
      )}
    </div>
  );
}

/** Ratio z-score mapped to the spec's required probabilistic vocabulary — never a directive. */
function ratioReading(z) {
  if (z === null) return { label: 'N/A', text: 'Awaiting enough history to compute.' };
  if (Math.abs(z) < 1) return { label: 'NEUTRAL', text: 'Within +/-1σ of its 1-year mean — not a statistically unusual reading.' };
  if (Math.abs(z) < 2) {
    return z > 0
      ? { label: 'ELEVATED', text: 'Between 1 and 2σ above its 1-year mean — elevated, not yet statistically extreme.' }
      : { label: 'DEPRESSED', text: 'Between 1 and 2σ below its 1-year mean — depressed, not yet statistically extreme.' };
  }
  return z > 0
    ? { label: 'STATISTICALLY UNUSUAL (HIGH)', text: 'More than 2σ above its 1-year mean — a potential setup for reversion, confirmation required before acting.' }
    : { label: 'STATISTICALLY UNUSUAL (LOW)', text: 'More than 2σ below its 1-year mean — a potential setup for reversion, confirmation required before acting.' };
}

export default function MarketOverview() {
  const wti = useWtiSpot();
  const hh = useHenryHubSpot();
  const inventory = useCrudeInventory();
  const cushing = useCushingInventory();
  const dxy = useDxy();
  const dgs10 = useTenYearYield();
  // Independent second source for the two headline prices — surfaced as a
  // small cross-check line, not used in any calculation, so it fails
  // silently (undefined) if the optional Alpha Vantage key isn't set or
  // its free-tier rate limit is hit.
  const avWti = useAvWti();
  const avNaturalGas = useAvNaturalGas();

  const { series: fullRatioSeries } = useOilGasRatioSeries();
  const ratioSeries = useMemo(() => fullRatioSeries.slice(-365), [fullRatioSeries]);

  const bands = useMemo(() => ratioBands(ratioSeries), [ratioSeries]);
  // Read the "current" ratio off the same date-aligned series the chart
  // renders (last element of the inner-joined ratioSeries), not from each
  // instrument's raw last observation independently. WTI and Henry Hub
  // don't always publish on the exact same calendar day, so computing the
  // ratio from two independently-latest points can silently divide prices
  // from two different dates — this was the root cause of the ratio
  // reading differently here than on the Spread & Signals chart.
  const latestRatioPoint = ratioSeries.length ? ratioSeries[ratioSeries.length - 1] : null;
  const currentRatio = latestRatioPoint?.ratio ?? null;
  const ratioValues = useMemo(() => ratioSeries.map((p) => p.ratio), [ratioSeries]);
  const ratioZ = useMemo(() => (currentRatio !== null ? zScore(currentRatio, ratioValues) : null), [currentRatio, ratioValues]);
  const ratioPercentile = useMemo(
    () => (currentRatio !== null ? percentileRank(currentRatio, ratioValues) : null),
    [currentRatio, ratioValues]
  );
  const reading = ratioReading(ratioZ);

  const inventoryChange = useMemo(() => {
    if (!inventory.data || inventory.data.length < 2) return null;
    const latest = inventory.data[inventory.data.length - 1];
    const prior = inventory.data[inventory.data.length - 2];
    return { latest, prior, delta: latest.value - prior.value };
  }, [inventory.data]);

  const cushingChange = useMemo(() => {
    if (!cushing.data || cushing.data.length < 2) return null;
    const latest = cushing.data[cushing.data.length - 1];
    const prior = cushing.data[cushing.data.length - 2];
    return { latest, prior, delta: latest.value - prior.value };
  }, [cushing.data]);

  const macroChange = (series) => {
    if (!series || series.length < 2) return { value: null, change: null };
    const latest = series[series.length - 1].value;
    const prior = series[series.length - 2].value;
    return { value: latest, change: ((latest - prior) / prior) * 100 };
  };
  const dxyLatest = macroChange(dxy.data);
  const dgs10Latest = macroChange(dgs10.data);

  return (
    <div className="space-y-4">
      <DataHealth />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PriceChart
          title="WTI CUSHING SPOT"
          series={wti.data}
          color="#22c55e"
          isLoading={wti.isLoading}
          isError={wti.isError}
          isStale={wti.isPlaceholderData}
          crossCheck={avWti.data?.[avWti.data.length - 1]?.value ?? null}
          meta={INSTRUMENTS.wtiSpot}
        />
        <PriceChart
          title="HENRY HUB NATURAL GAS SPOT ($/MMBtu)"
          series={hh.data}
          color="#38bdf8"
          isLoading={hh.isLoading}
          isError={hh.isError}
          isStale={hh.isPlaceholderData}
          crossCheck={avNaturalGas.data?.[avNaturalGas.data.length - 1]?.value ?? null}
          meta={INSTRUMENTS.henryHubSpot}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <span>OIL-TO-GAS RATIO</span>
            <span className="text-terminal-text tabular text-sm">
              {currentRatio ? formatNumber(currentRatio) : '—'}
              {latestRatioPoint && <span className="text-terminal-muted ml-1">({formatDate(latestRatioPoint.date, { includeYear: false })})</span>}
            </span>
          </div>
          <div className="p-3">
            <SpreadBandChart
              ratioSeries={ratioSeries}
              bands={bands}
              isLoading={wti.isLoading || hh.isLoading}
              isError={wti.isError || hh.isError}
            />
          </div>
          <div className="px-3 pb-3 text-[10px] text-terminal-muted">
            Formula: WTI Cushing Spot ($/bbl) ÷ Henry Hub Spot ($/MMBtu) — series {INSTRUMENTS.wtiSpot.seriesId} and{' '}
            {INSTRUMENTS.henryHubSpot.seriesId}, inner-joined on shared observation dates before dividing.
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>OIL-TO-GAS RATIO — SIGNAL</span>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div>
              <div className="stat-label">Current Reading</div>
              <div className="text-2xl font-semibold tabular">{currentRatio ? formatNumber(currentRatio) : '—'}</div>
              <div className="text-[10px] text-terminal-muted">
                {latestRatioPoint ? `as of ${formatDate(latestRatioPoint.date)} (WTI & HH date-aligned)` : '—'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="stat-label">1Y Mean</div>
                <div className="text-sm tabular">{bands ? formatNumber(bands.mean) : '—'}</div>
              </div>
              <div>
                <div className="stat-label">1Y Std Dev</div>
                <div className="text-sm tabular">{bands ? formatNumber(bands.stdDev) : '—'}</div>
              </div>
              <div>
                <div className="stat-label">Z-Score</div>
                <div className="text-sm tabular">{formatSigma(ratioZ)}</div>
              </div>
              <div>
                <div className="stat-label">Percentile (1Y)</div>
                <div className="text-sm tabular">{ratioPercentile !== null ? `${ratioPercentile.toFixed(0)}th` : '—'}</div>
              </div>
            </div>
            <div>
              <div
                className={`text-sm font-semibold tracking-wide ${
                  reading.label === 'NEUTRAL' || reading.label === 'N/A' ? 'text-terminal-muted' : 'text-signal'
                }`}
              >
                {reading.label}
              </div>
              <p className="text-[11px] text-terminal-muted mt-1 leading-snug">{reading.text}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel lg:col-span-1">
          <div className="panel-header">
            <span>WEEKLY CRUDE INVENTORY</span>
          </div>
          <div className="p-4">
            {inventory.isLoading ? (
              <div className="h-16 bg-zinc-900 rounded animate-pulse" />
            ) : inventoryChange ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-semibold tabular ${inventoryChange.delta < 0 ? 'text-bull' : 'text-bear'}`}>
                    {inventoryChange.delta < 0 ? 'DRAW' : 'BUILD'}
                  </span>
                  <span className="text-sm text-terminal-muted tabular">
                    {formatCompactNumber(Math.abs(inventoryChange.delta))} kbbl
                  </span>
                </div>
                <div className="mt-2 h-3 w-full bg-zinc-900 rounded overflow-hidden flex">
                  <div
                    className={`h-full ${inventoryChange.delta < 0 ? 'bg-bull' : 'bg-bear'}`}
                    style={{
                      width: `${Math.min(100, (Math.abs(inventoryChange.delta) / (inventoryChange.prior.value * 0.02)) * 100)}%`
                    }}
                  />
                </div>
                <div className="text-[11px] text-terminal-muted mt-2 tabular">
                  {INSTRUMENTS.crudeInventory.unit}, week of {formatDate(inventoryChange.latest.date)} vs{' '}
                  {formatDate(inventoryChange.prior.date)} · source: {INSTRUMENTS.crudeInventory.source}
                </div>
                {cushingChange && (
                  <div className="text-[11px] text-terminal-muted mt-1 tabular">
                    Cushing: {cushingChange.delta >= 0 ? '+' : ''}
                    {formatCompactNumber(cushingChange.delta)} kbbl w/w (
                    {formatCompactNumber(cushingChange.latest.value)} kbbl total)
                  </div>
                )}
                <p className="text-[11px] text-terminal-muted mt-2 leading-snug">
                  Commercial crude stocks {inventoryChange.delta < 0 ? 'fell' : 'rose'} week-over-week. This is one
                  input among many (also watch refinery runs, exports, and the seasonal 5-year range on the
                  Fundamentals tab) — not, on its own, a bullish or bearish conclusion.
                </p>
              </>
            ) : (
              <div className="text-sm text-terminal-muted">No inventory data available.</div>
            )}
          </div>
        </div>

        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <span>MACRO CONTEXT (OPTIONAL)</span>
          </div>
          <div className="flex flex-wrap">
            <MacroTile
              label="DXY (Broad, FRED proxy)"
              value={dxyLatest.value}
              change={dxyLatest.change}
              isLoading={dxy.isLoading}
              isError={dxy.isError}
            />
            <MacroTile
              label="10Y TREASURY YIELD"
              value={dgs10Latest.value}
              change={dgs10Latest.change}
              unit="%"
              isLoading={dgs10.isLoading}
              isError={dgs10.isError}
            />
          </div>
          <div className="px-4 pb-3 text-[10px] text-terminal-muted">
            Optional context only — add FRED_API_KEY to enable. The rest of the dashboard is fully functional
            without it.
          </div>
        </div>
      </div>
    </div>
  );
}
