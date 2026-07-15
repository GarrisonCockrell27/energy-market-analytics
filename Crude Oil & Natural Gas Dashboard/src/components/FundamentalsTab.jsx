import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Area, ComposedChart } from 'recharts';
import {
  useCrudeProduction,
  useCrudeInventory,
  useCushingInventory,
  useRefineryUtilization,
  useCrudeExports,
  useHenryHubStorage
} from '../hooks/useEIAData.js';
import { seasonalAverageByWeek } from '../utils/calculations.js';
import { formatDate, formatCompactNumber } from '../utils/formatters.js';
import { INSTRUMENTS } from '../utils/instruments.js';
import WeeklyThesis from './WeeklyThesis.jsx';

function ChartSkeleton() {
  return <div className="h-56 w-full rounded bg-zinc-900 animate-pulse" />;
}

function ChartFooter({ instrumentKey, latestDate, note }) {
  const meta = INSTRUMENTS[instrumentKey];
  return (
    <div className="px-3 pb-3 text-[10px] text-terminal-muted">
      <div className="flex justify-between">
        <span>
          {meta.source} · {meta.seriesId} · {meta.unit}
        </span>
        <span>as of {latestDate ? formatDate(latestDate) : '—'}</span>
      </div>
      {note && <p className="mt-1 leading-snug">{note}</p>}
    </div>
  );
}

/** Simple 52-week trend line for a focused fundamentals series (Cushing, refinery utilization, exports). */
function TrendChart({ title, instrumentKey, query, color, unitLabel, note, weeks = 52 }) {
  const windowed = useMemo(() => (query.data ? query.data.slice(-weeks) : []), [query.data, weeks]);
  const latest = windowed.length ? windowed[windowed.length - 1] : null;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>{title}</span>
        {latest && <span className="tabular text-sm text-terminal-text">{formatCompactNumber(latest.value)} {unitLabel}</span>}
      </div>
      <div className="p-3">
        {query.isLoading ? (
          <ChartSkeleton />
        ) : query.isError && windowed.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-bear text-sm">Failed to load data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={windowed} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { includeYear: false })} stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} minTickGap={30} />
              <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} width={50} domain={['auto', 'auto']} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip contentStyle={{ background: '#0f1012', border: '1px solid #27272a', fontSize: 12 }} labelFormatter={(d) => formatDate(d)} formatter={(v) => [`${formatCompactNumber(v)} ${unitLabel}`, title]} />
              <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={1.75} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <ChartFooter instrumentKey={instrumentKey} latestDate={latest?.date} note={note} />
    </div>
  );
}

/** Current-year vs 5-year mean + range seasonal comparison (crude inventory, HH storage). */
function SeasonalChart({ title, instrumentKey, query, unitLabel, note }) {
  const seasonal = useMemo(() => (query.data ? seasonalAverageByWeek(query.data) : []), [query.data]);
  const latest = query.data?.length ? query.data[query.data.length - 1] : null;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>{title}</span>
      </div>
      <div className="p-3">
        {query.isLoading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={seasonal} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <XAxis dataKey="weekOfYear" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} label={{ value: 'Week of Year', position: 'insideBottom', offset: -2, fill: '#71717a', fontSize: 10 }} />
              <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} width={50} domain={['auto', 'auto']} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip contentStyle={{ background: '#0f1012', border: '1px solid #27272a', fontSize: 12 }} formatter={(v, name) => [v === null ? '—' : `${formatCompactNumber(v)} ${unitLabel}`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="seasonalMax" name="5Y Range" stroke="none" fill="#3f3f46" fillOpacity={0.35} connectNulls />
              <Area type="monotone" dataKey="seasonalMin" name=" " stroke="none" fill="#09090b" fillOpacity={1} connectNulls legendType="none" />
              <Line type="monotone" dataKey="seasonalAvg" name="5Y Average" stroke="#71717a" strokeDasharray="4 3" dot={false} strokeWidth={1.5} connectNulls />
              <Line type="monotone" dataKey="current" name="This Year" stroke="#38bdf8" dot={false} strokeWidth={2} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <ChartFooter instrumentKey={instrumentKey} latestDate={latest?.date} note={note} />
    </div>
  );
}

export default function FundamentalsTab() {
  const production = useCrudeProduction();
  const inventory = useCrudeInventory();
  const cushing = useCushingInventory();
  const refineryUtilization = useRefineryUtilization();
  const crudeExports = useCrudeExports();
  const hhStorage = useHenryHubStorage();

  const productionWindow = useMemo(() => (production.data ? production.data.slice(-52) : []), [production.data]);
  const productionLatest = productionWindow.length ? productionWindow[productionWindow.length - 1] : null;

  const hhWeeklyChange = useMemo(() => {
    if (!hhStorage.data || hhStorage.data.length < 2) return null;
    const latest = hhStorage.data[hhStorage.data.length - 1];
    const prior = hhStorage.data[hhStorage.data.length - 2];
    return { latest, prior, delta: latest.value - prior.value };
  }, [hhStorage.data]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-terminal-muted tracking-wider mb-2">WTI / CRUDE OIL FUNDAMENTALS</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="panel">
            <div className="panel-header">
              <span>US CRUDE PRODUCTION — LAST 52 WEEKS</span>
              {productionLatest && <span className="tabular text-sm">{formatCompactNumber(productionLatest.value)} kbbl/day</span>}
            </div>
            <div className="p-3">
              {production.isLoading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={productionWindow} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { includeYear: false })} stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} minTickGap={30} />
                    <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} width={50} tickFormatter={(v) => formatCompactNumber(v)} />
                    <Tooltip contentStyle={{ background: '#0f1012', border: '1px solid #27272a', fontSize: 12 }} labelFormatter={(d) => formatDate(d)} formatter={(v) => [`${formatCompactNumber(v)} kbbl/day`, 'Production']} />
                    <Line type="monotone" dataKey="value" stroke="#22c55e" dot={false} strokeWidth={1.75} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <ChartFooter instrumentKey="crudeProduction" latestDate={productionLatest?.date} note={INSTRUMENTS.crudeProduction.traderNote} />
          </div>

          <SeasonalChart
            title="CRUDE INVENTORY VS 5-YEAR RANGE"
            instrumentKey="crudeInventory"
            query={inventory}
            unitLabel="kbbl"
            note={INSTRUMENTS.crudeInventory.traderNote}
          />

          <TrendChart title="CUSHING, OK INVENTORY" instrumentKey="cushingInventory" query={cushing} color="#f59e0b" unitLabel="kbbl" note={INSTRUMENTS.cushingInventory.traderNote} />
          <TrendChart title="REFINERY UTILIZATION" instrumentKey="refineryUtilization" query={refineryUtilization} color="#a78bfa" unitLabel="%" note={INSTRUMENTS.refineryUtilization.traderNote} />
          <TrendChart title="US CRUDE EXPORTS" instrumentKey="crudeExports" query={crudeExports} color="#38bdf8" unitLabel="kbbl/day" note={INSTRUMENTS.crudeExports.traderNote} />

          <div className="panel">
            <div className="panel-header">
              <span>RIG COUNT TREND</span>
            </div>
            <div className="p-4 flex items-center justify-center text-terminal-muted text-xs h-full min-h-[80px]">
              UNAVAILABLE — no free, no-credential rig count feed is wired up (Baker Hughes requires a licensed
              data agreement).
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-terminal-muted tracking-wider mb-2">HENRY HUB / NATURAL GAS FUNDAMENTALS</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SeasonalChart
            title="WORKING GAS IN STORAGE VS 5-YEAR RANGE"
            instrumentKey="henryHubStorage"
            query={hhStorage}
            unitLabel="Bcf"
            note={INSTRUMENTS.henryHubStorage.traderNote}
          />

          <div className="panel">
            <div className="panel-header">
              <span>WEEKLY INJECTION / WITHDRAWAL</span>
            </div>
            <div className="p-4">
              {hhStorage.isLoading ? (
                <div className="h-16 bg-zinc-900 rounded animate-pulse" />
              ) : hhWeeklyChange ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-semibold tabular ${hhWeeklyChange.delta < 0 ? 'text-bull' : 'text-bear'}`}>
                      {hhWeeklyChange.delta < 0 ? 'WITHDRAWAL' : 'INJECTION'}
                    </span>
                    <span className="text-sm text-terminal-muted tabular">{formatCompactNumber(Math.abs(hhWeeklyChange.delta))} Bcf</span>
                  </div>
                  <div className="text-[11px] text-terminal-muted mt-2 tabular">
                    Week of {formatDate(hhWeeklyChange.latest.date)} vs {formatDate(hhWeeklyChange.prior.date)} · total in storage:{' '}
                    {formatCompactNumber(hhWeeklyChange.latest.value)} Bcf
                  </div>
                  <p className="text-[11px] text-terminal-muted mt-2 leading-snug">
                    A withdrawal (stocks fall) is typical in the winter heating season; an injection (stocks rise) is
                    typical April-October. Compare against the 5-year range chart to see if this week's move is
                    seasonally normal or an outlier — one week alone isn't a directional conclusion.
                  </p>
                </>
              ) : (
                <div className="text-sm text-terminal-muted">No storage data available.</div>
              )}
            </div>
          </div>

          <div className="panel lg:col-span-2">
            <div className="panel-header">
              <span>DRY-GAS PRODUCTION / HDD-CDD / LNG FEEDGAS</span>
            </div>
            <div className="p-4 text-terminal-muted text-xs leading-relaxed">
              UNAVAILABLE — no dependable free, no-credential source for dry-gas production, heating/cooling degree
              days, or LNG feedgas is wired up in this build. Adding one would require documenting the provider,
              coverage, and cost before integrating (see README "Known Limitations").
            </div>
          </div>
        </div>
      </div>

      <WeeklyThesis />
    </div>
  );
}
