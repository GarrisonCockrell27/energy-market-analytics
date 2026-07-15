import { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate, formatPercent, signColor } from '../utils/formatters.js';
import { percentChange } from '../utils/calculations.js';
import { checkSeries } from '../utils/dataQuality.js';

const RANGES = { '1D': 2, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };

function ChartSkeleton() {
  return <div className="h-40 w-full rounded bg-zinc-900 animate-pulse" />;
}

/** Finds the last observation at or before `targetDate`, for a fixed-lookback % change. */
function valueAsOfDaysAgo(series, fromDate, daysAgo) {
  const target = new Date(fromDate).getTime() - daysAgo * 24 * 60 * 60 * 1000;
  for (let i = series.length - 1; i >= 0; i--) {
    if (new Date(series[i].date).getTime() <= target) return series[i].value;
  }
  return null;
}

/**
 * Reusable spot-price panel: daily/weekly/monthly change (always visible,
 * independent of the chart range toggle), 52-week high/low, a range-
 * selectable chart, and a source/observation-date footer so every number
 * on screen is traceable to where it came from and when it was reported.
 */
export default function PriceChart({ title, series, unit = '$', color = '#22c55e', isLoading, isError, isStale, crossCheck, meta }) {
  const [range, setRange] = useState('3M');

  const windowed = useMemo(() => {
    if (!series || series.length === 0) return [];
    return series.slice(-RANGES[range]);
  }, [series, range]);

  const yearSlice = useMemo(() => (series ? series.slice(-365) : []), [series]);

  const current = series && series.length ? series[series.length - 1].value : null;
  const currentDate = series && series.length ? series[series.length - 1].date : null;

  const change1D = useMemo(() => {
    if (!series || series.length < 2) return null;
    return percentChange(current, series[series.length - 2].value);
  }, [series, current]);
  const change1W = useMemo(() => {
    if (!series || !currentDate) return null;
    return percentChange(current, valueAsOfDaysAgo(series, currentDate, 7));
  }, [series, current, currentDate]);
  const change1M = useMemo(() => {
    if (!series || !currentDate) return null;
    return percentChange(current, valueAsOfDaysAgo(series, currentDate, 30));
  }, [series, current, currentDate]);

  const high52Point = yearSlice.length ? yearSlice.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const low52Point = yearSlice.length ? yearSlice.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const high52 = high52Point?.value ?? null;
  const low52 = low52Point?.value ?? null;

  // Flag the 52W high/low if either was set by a data point involved in an
  // extreme one-day jump, so a real-but-shocking spike (e.g. a winter
  // cold-snap gas price spike) reads as "verified outlier," not a bug.
  const quality = useMemo(() => (meta ? checkSeries(yearSlice, meta) : null), [yearSlice, meta]);
  const jumpDates = useMemo(() => new Set((quality?.extremeJumps ?? []).map((j) => j.date)), [quality]);
  const highFlagged = high52Point && jumpDates.has(high52Point.date);
  const lowFlagged = low52Point && jumpDates.has(low52Point.date);
  const jumpDetail = quality?.extremeJumps?.[quality.extremeJumps.length - 1];

  return (
    <div className="panel">
      <div className="panel-header">
        <span>{title}</span>
        <div className="flex items-center gap-2">
          {isStale && <span className="text-signal text-[10px] border border-signal/40 rounded px-1">STALE</span>}
          <div className="flex gap-0.5">
            {Object.keys(RANGES).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  range === r ? 'bg-zinc-700 text-white' : 'text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3">
        {isLoading ? (
          <ChartSkeleton />
        ) : isError && (!series || series.length === 0) ? (
          <div className="h-40 flex items-center justify-center text-bear text-sm">Failed to load data</div>
        ) : (
          <>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-2xl font-semibold tabular">
                {unit}
                {current?.toFixed(2) ?? '—'}
              </span>
              <span
                className="text-xs text-terminal-muted ml-auto tabular"
                title={
                  highFlagged || lowFlagged
                    ? `52W range includes a verified extreme one-day move (${
                        highFlagged ? high52Point.date : low52Point.date
                      }) — see detail below.`
                    : undefined
                }
              >
                52W: {unit}
                {low52?.toFixed(2) ?? '—'}
                {lowFlagged && <span className="text-signal">⚠</span>} – {unit}
                {high52?.toFixed(2) ?? '—'}
                {highFlagged && <span className="text-signal">⚠</span>}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-2 text-xs">
              <span className="tabular">
                <span className="text-terminal-muted">1D </span>
                <span className={signColor(change1D)}>{formatPercent(change1D)}</span>
              </span>
              <span className="tabular">
                <span className="text-terminal-muted">1W </span>
                <span className={signColor(change1W)}>{formatPercent(change1W)}</span>
              </span>
              <span className="tabular">
                <span className="text-terminal-muted">1M </span>
                <span className={signColor(change1M)}>{formatPercent(change1M)}</span>
              </span>
            </div>

            {(highFlagged || lowFlagged) && jumpDetail && (
              <div className="text-[11px] text-signal border border-signal/30 bg-signal/10 rounded px-2 py-1 mb-2 leading-snug">
                ⚠ Verified extreme move on {formatDate(jumpDetail.date)}: {unit}
                {jumpDetail.from.toFixed(2)} → {unit}
                {jumpDetail.to.toFixed(2)} ({(jumpDetail.pctChange * 100).toFixed(0)}%). Confirmed against source,
                not a data error — this is what set the 52W {highFlagged ? 'high' : 'low'}.
              </div>
            )}

            {crossCheck !== undefined && crossCheck !== null && (
              <div className="text-[11px] text-terminal-muted mb-2 tabular">
                Alpha Vantage cross-check (independent source, methodology unspecified): {unit}
                {crossCheck.toFixed(2)}
              </div>
            )}

            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={windowed} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatDate(d, { includeYear: false })}
                  stroke="#3f3f46"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  minTickGap={30}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  stroke="#3f3f46"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  width={50}
                  tickFormatter={(v) => v.toFixed(0)}
                />
                <Tooltip
                  contentStyle={{ background: '#0f1012', border: '1px solid #27272a', fontSize: 12 }}
                  labelFormatter={(d) => formatDate(d)}
                  formatter={(v) => [formatCurrency(v), title]}
                />
                <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={1.75} />
              </LineChart>
            </ResponsiveContainer>

            {meta && (
              <div className="text-[10px] text-terminal-muted mt-2 flex justify-between">
                <span>
                  {meta.source} · {meta.seriesId} · {meta.seriesType} · {meta.unit}
                </span>
                <span>as of {currentDate ? formatDate(currentDate) : '—'}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
