import { useMemo, useState } from 'react';
import {
  useWtiSpot,
  useHenryHubSpot,
  useCrudeInventory,
  useCushingInventory,
  useRefineryUtilization,
  useCrudeExports,
  useCrudeProduction,
  useHenryHubStorage,
  useWtiFuturesNear,
  useWtiFuturesFar,
  useGasolineSpot,
  useHeatingOilSpot
} from '../hooks/useEIAData.js';
import { useAvWti, useAvNaturalGas } from '../hooks/useAlphaVantage.js';
import { useDxy, useTenYearYield } from '../hooks/useFRED.js';
import { useKeyStatus } from '../hooks/useKeyStatus.js';
import { INSTRUMENTS } from '../utils/instruments.js';
import { describeQueryHealth, summarizeHealth, STATUS } from '../utils/dataQuality.js';
import { formatDate, formatRelativeTime } from '../utils/formatters.js';

const STATUS_STYLE = {
  [STATUS.CURRENT]: 'text-bull',
  [STATUS.STALE]: 'text-signal',
  [STATUS.HISTORICAL]: 'text-sky-400',
  [STATUS.NOT_CONFIGURED]: 'text-terminal-muted',
  [STATUS.FAILED]: 'text-bear',
  [STATUS.UNAVAILABLE]: 'text-terminal-muted'
};

const SEVERITY_STYLE = {
  error: 'text-bear',
  warn: 'text-signal',
  info: 'text-terminal-muted'
};

const TIER_LABEL = {
  core: 'CORE (REQUIRED)',
  historical: 'HISTORICAL (EIA-DISCONTINUED)',
  optional: 'OPTIONAL INTEGRATIONS'
};

function HealthTable({ records }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-terminal-muted uppercase border-b border-terminal-border">
          <th className="px-3 py-2">Instrument</th>
          <th className="px-3 py-2">Source</th>
          <th className="px-3 py-2">Last Obs.</th>
          <th className="px-3 py-2">App Refresh</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">Notes</th>
        </tr>
      </thead>
      <tbody>
        {records.map((r) => (
          <tr key={r.key} className="border-b border-terminal-border/60">
            <td className="px-3 py-2">{r.name}</td>
            <td className="px-3 py-2 text-terminal-muted">{r.source}</td>
            <td className="px-3 py-2 tabular">{r.lastObservationDate ? formatDate(r.lastObservationDate) : '—'}</td>
            <td className="px-3 py-2 tabular text-terminal-muted">
              {r.lastRefresh ? formatRelativeTime(r.lastRefresh) : '—'}
            </td>
            <td className={`px-3 py-2 font-medium ${STATUS_STYLE[r.status]}`}>{r.status.replace('_', ' ')}</td>
            <td className="px-3 py-2 max-w-[420px]">
              {r.warnings.length === 0 ? (
                <span className="text-terminal-muted">—</span>
              ) : (
                <ul className="space-y-0.5">
                  {r.warnings.map((w, i) => (
                    <li key={i} className={SEVERITY_STYLE[w.severity] ?? 'text-terminal-muted'}>
                      {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Per-instrument data-quality dashboard, grouped into core / historical /
 * optional tiers with an honest status per instrument (see STATUS in
 * dataQuality.js) — a discontinued source is HISTORICAL, an unconfigured
 * optional key is NOT_CONFIGURED, and FAILED is reserved for a source that
 * was actually expected to work right now and didn't.
 *
 * Re-uses the same hooks every panel already calls — React Query dedupes
 * by query key, so this doesn't trigger extra network requests.
 */
export default function DataHealth() {
  const [expanded, setExpanded] = useState(false);
  const keyStatusQuery = useKeyStatus();

  const queries = {
    wtiSpot: useWtiSpot(),
    henryHubSpot: useHenryHubSpot(),
    crudeInventory: useCrudeInventory(),
    cushingInventory: useCushingInventory(),
    refineryUtilization: useRefineryUtilization(),
    crudeExports: useCrudeExports(),
    crudeProduction: useCrudeProduction(),
    henryHubStorage: useHenryHubStorage(),
    gasolineSpot: useGasolineSpot(),
    heatingOilSpot: useHeatingOilSpot(),
    wtiFutContract1: useWtiFuturesNear(),
    wtiFutContract4: useWtiFuturesFar(),
    avWti: useAvWti(),
    avNaturalGas: useAvNaturalGas(),
    dxy: useDxy(),
    dgs10: useTenYearYield()
  };

  const records = useMemo(
    () =>
      Object.entries(queries).map(([key, query]) =>
        describeQueryHealth(key, INSTRUMENTS[key], query, keyStatusQuery.data)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...Object.values(queries).flatMap((q) => [q.dataUpdatedAt, q.isError, q.isFetching]), keyStatusQuery.data]
  );

  const { summary, healthy } = useMemo(() => summarizeHealth(records), [records]);

  const coreRecords = records.filter((r) => r.tier === 'core');
  const historicalRecords = records.filter((r) => r.tier === 'historical');
  const optionalRecords = records.filter((r) => r.tier === 'optional');

  return (
    <div className="panel">
      <button className="panel-header w-full text-left" onClick={() => setExpanded((e) => !e)}>
        <span>DATA HEALTH</span>
        <span className="flex items-center gap-2 text-[11px]">
          <span className={healthy ? 'text-bull' : 'text-signal'}>{summary}</span>
          <span className="text-terminal-muted">{expanded ? '▲' : '▼'}</span>
        </span>
      </button>

      {expanded && (
        <div className="overflow-x-auto divide-y divide-terminal-border">
          {[
            ['core', coreRecords],
            ['historical', historicalRecords],
            ['optional', optionalRecords]
          ].map(
            ([tier, tierRecords]) =>
              tierRecords.length > 0 && (
                <div key={tier}>
                  <div className="px-3 py-1.5 text-[10px] tracking-wider text-terminal-muted bg-zinc-900/60">
                    {TIER_LABEL[tier]}
                  </div>
                  <HealthTable records={tierRecords} />
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
