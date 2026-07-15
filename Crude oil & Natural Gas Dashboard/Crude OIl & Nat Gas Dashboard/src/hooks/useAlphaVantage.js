import { useQuery } from '@tanstack/react-query';

// Alpha Vantage's free tier is capped at 25 requests/day, far too tight for
// a 5-minute auto-refresh loop. These hooks deliberately use a much longer
// refetchInterval than the app default so a single session doesn't burn
// through the daily quota. EIA remains the primary source for history-heavy
// panels (inventory, production, futures curve) since it has no such cap.
const AV_REFETCH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchAvSeries(functionName, extraParams = {}) {
  const params = new URLSearchParams({ function: functionName, interval: 'daily', ...extraParams });
  const res = await fetch(`/api/alphavantage?${params.toString()}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || 'Alpha Vantage request failed');

  const rows = body?.data ?? [];
  return rows
    .map((row) => ({ date: row.date, value: Number(row.value) }))
    .filter((row) => row.value && !Number.isNaN(row.value))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** WTI daily series from Alpha Vantage's commodities endpoint (cross-check vs EIA). */
export function useAvWti() {
  return useQuery({
    queryKey: ['alphavantage', 'wti'],
    queryFn: () => fetchAvSeries('WTI'),
    refetchInterval: AV_REFETCH_INTERVAL_MS,
    placeholderData: (prev) => prev,
    retry: false
  });
}

/** Henry Hub natural gas daily series from Alpha Vantage's commodities endpoint. */
export function useAvNaturalGas() {
  return useQuery({
    queryKey: ['alphavantage', 'natural_gas'],
    queryFn: () => fetchAvSeries('NATURAL_GAS'),
    refetchInterval: AV_REFETCH_INTERVAL_MS,
    placeholderData: (prev) => prev,
    retry: false
  });
}
