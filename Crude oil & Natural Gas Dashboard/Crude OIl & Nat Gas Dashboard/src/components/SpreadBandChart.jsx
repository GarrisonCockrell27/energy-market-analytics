import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatNumber } from '../utils/formatters.js';

/**
 * Oil-to-gas ratio chart with optional mean and +/-1/2 standard deviation
 * reference lines. Shared by the Market Overview ratio panel and the full
 * 90-day Spread & Signals view.
 */
export default function SpreadBandChart({ ratioSeries, bands, showBands = true, height = 220, isLoading, isError }) {
  if (isLoading) {
    return <div className="w-full rounded bg-zinc-900 animate-pulse" style={{ height }} />;
  }
  if (isError && (!ratioSeries || ratioSeries.length === 0)) {
    return (
      <div className="flex items-center justify-center text-bear text-sm" style={{ height }}>
        Failed to load ratio data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={ratioSeries} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
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
          width={40}
          tickFormatter={(v) => v.toFixed(1)}
        />
        <Tooltip
          contentStyle={{ background: '#0f1012', border: '1px solid #27272a', fontSize: 12 }}
          labelFormatter={(d) => formatDate(d)}
          formatter={(v) => [formatNumber(v, { decimals: 2 }), 'Ratio']}
        />

        {showBands && bands && (
          <>
            <ReferenceLine y={bands.mean} stroke="#71717a" strokeDasharray="4 2" label={{ value: 'μ', fill: '#a1a1aa', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={bands.upper1} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '+1σ', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={bands.lower1} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '-1σ', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={bands.upper2} stroke="#ef4444" strokeDasharray="2 4" strokeOpacity={0.5} label={{ value: '+2σ', fill: '#ef4444', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={bands.lower2} stroke="#ef4444" strokeDasharray="2 4" strokeOpacity={0.5} label={{ value: '-2σ', fill: '#ef4444', fontSize: 10, position: 'right' }} />
          </>
        )}

        <Line type="monotone" dataKey="ratio" stroke="#38bdf8" dot={false} strokeWidth={1.75} />
      </LineChart>
    </ResponsiveContainer>
  );
}
