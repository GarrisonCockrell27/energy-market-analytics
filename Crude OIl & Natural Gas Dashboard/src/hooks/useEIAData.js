import { useQuery } from '@tanstack/react-query';
import { INSTRUMENTS } from '../utils/instruments.js';

// All EIA v2 requests go through /api/eia (see api/eia.js), which injects
// EIA_API_KEY server-side. We use EIA's "seriesid" convenience route, which
// accepts legacy v1-style series IDs (e.g. "PET.RWTC.D") and is the most
// robust way to hit a specific known series without re-deriving each
// dataset's v2 facet structure. Series IDs live in one place —
// utils/instruments.js — so a hook and its Data Health entry can never drift.

async function fetchEiaSeries(seriesId, { length = 260 } = {}) {
  const params = new URLSearchParams({
    route: `seriesid/${seriesId}`,
    'sort[0][column]': 'period',
    'sort[0][direction]': 'desc',
    length: String(length)
  });
  const res = await fetch(`/api/eia?${params.toString()}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || 'EIA request failed');

  const rows = body?.response?.data ?? [];
  return rows
    .map((row) => ({ date: row.period, value: Number(row.value) }))
    .filter((row) => !Number.isNaN(row.value))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function useEiaSeries(instrumentKey, options = {}) {
  return useQuery({
    queryKey: ['eia', instrumentKey],
    queryFn: () => fetchEiaSeries(INSTRUMENTS[instrumentKey].seriesId, options),
    placeholderData: (prev) => prev // keep showing last good data while refetching (stale-but-served)
  });
}

/** Daily WTI Cushing spot price, ~13 months of history. */
export function useWtiSpot() {
  return useEiaSeries('wtiSpot', { length: 400 });
}

/** Daily Henry Hub spot price, ~13 months of history. */
export function useHenryHubSpot() {
  return useEiaSeries('henryHubSpot', { length: 400 });
}

/** Weekly US commercial crude ending stocks (ex-SPR), 5+ years for seasonal comparison. */
export function useCrudeInventory() {
  return useEiaSeries('crudeInventory', { length: 300 });
}

/** Weekly Cushing, OK crude ending stocks (ex-SPR) — the WTI delivery point. */
export function useCushingInventory() {
  return useEiaSeries('cushingInventory', { length: 60 });
}

/** Weekly US refinery operable capacity utilization, % — crude demand proxy. */
export function useRefineryUtilization() {
  return useEiaSeries('refineryUtilization', { length: 60 });
}

/** Weekly US crude oil exports, thousand bbl/day. */
export function useCrudeExports() {
  return useEiaSeries('crudeExports', { length: 60 });
}

/** Weekly US field production of crude oil, most recent ~52 weeks by default. */
export function useCrudeProduction() {
  return useEiaSeries('crudeProduction', { length: 104 });
}

/** Weekly Lower 48 working natural gas in storage, 5+ years for seasonal comparison. */
export function useHenryHubStorage() {
  return useEiaSeries('henryHubStorage', { length: 300 });
}

/** Near-month (contract 1) WTI futures settle — historical only, EIA discontinued this feed 2024-04-05. */
export function useWtiFuturesNear() {
  return useEiaSeries('wtiFutContract1', { length: 30 });
}

/** Far-month (contract 4, ~4 months out) WTI futures settle — historical only, see above. */
export function useWtiFuturesFar() {
  return useEiaSeries('wtiFutContract4', { length: 30 });
}

/** NY Harbor conventional gasoline spot price, $/gal — feeds the 3:2:1 crack spread. */
export function useGasolineSpot() {
  return useEiaSeries('gasolineSpot', { length: 30 });
}

/** NY Harbor No. 2 heating oil spot price, $/gal — feeds the 3:2:1 crack spread. */
export function useHeatingOilSpot() {
  return useEiaSeries('heatingOilSpot', { length: 30 });
}
