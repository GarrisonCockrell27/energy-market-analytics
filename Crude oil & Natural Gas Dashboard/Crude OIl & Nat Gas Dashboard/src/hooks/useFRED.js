import { useQuery } from '@tanstack/react-query';

// FRED series used for macro context. DTWEXBGS (Trade Weighted U.S. Dollar
// Index: Broad, Goods and Services) is a Fed-published broad dollar index —
// it tracks the same direction as the ICE DXY futures index but is not
// identical to it, since DXY uses a fixed 6-currency basket. It's the
// closest free, no-auth-hassle equivalent.
const FRED_SERIES = {
  dxyProxy: 'DTWEXBGS',
  tenYearYield: 'DGS10'
};

async function fetchFredSeries(seriesId, { limit = 60 } = {}) {
  const params = new URLSearchParams({
    series_id: seriesId,
    sort_order: 'desc',
    limit: String(limit)
  });
  const res = await fetch(`/api/fred?${params.toString()}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || 'FRED request failed');

  const rows = body?.observations ?? [];
  return rows
    .map((row) => ({ date: row.date, value: Number(row.value) }))
    .filter((row) => !Number.isNaN(row.value))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function useFredSeries(key, seriesId) {
  return useQuery({
    queryKey: ['fred', key],
    queryFn: () => fetchFredSeries(seriesId),
    placeholderData: (prev) => prev
  });
}

/** Broad dollar index (DXY proxy) — inversely correlated with crude, roughly. */
export function useDxy() {
  return useFredSeries('dxy', FRED_SERIES.dxyProxy);
}

/** 10-Year Treasury constant maturity yield — a macro risk-appetite gauge. */
export function useTenYearYield() {
  return useFredSeries('dgs10', FRED_SERIES.tenYearYield);
}
