import { useMemo } from 'react';
import { useWtiSpot, useHenryHubSpot, useGasolineSpot, useHeatingOilSpot } from './useEIAData.js';
import { buildRatioSeries, alignSeriesByDate, crackSpread321 } from '../utils/calculations.js';

/**
 * The date-aligned WTI/Henry Hub oil-to-gas ratio series, computed once
 * here and reused by Market Overview, Spread & Signals, and the Paper
 * Trade Journal — the exact bug this app originally shipped with was this
 * same calculation living in three places and drifting apart.
 */
export function useOilGasRatioSeries() {
  const wti = useWtiSpot();
  const hh = useHenryHubSpot();
  const series = useMemo(() => (wti.data && hh.data ? buildRatioSeries(wti.data, hh.data) : []), [wti.data, hh.data]);
  return { series, isLoading: wti.isLoading || hh.isLoading, isError: wti.isError || hh.isError, wti, hh };
}

/**
 * The date-aligned indicative 3:2:1 crack spread proxy series (WTI,
 * gasoline, and heating oil inner-joined on shared dates before netting),
 * shared by Spread & Signals and the Paper Trade Journal.
 */
export function useCrackSpreadSeries() {
  const wti = useWtiSpot();
  const gasoline = useGasolineSpot();
  const heatingOil = useHeatingOilSpot();

  const aligned = useMemo(() => {
    if (!wti.data || !gasoline.data || !heatingOil.data) return [];
    return alignSeriesByDate({ wti: wti.data, gasoline: gasoline.data, heatingOil: heatingOil.data });
  }, [wti.data, gasoline.data, heatingOil.data]);

  const series = useMemo(
    () =>
      aligned
        .map((row) => ({
          date: row.date,
          value: crackSpread321(row.values.wti, row.values.gasoline, row.values.heatingOil)
        }))
        .filter((p) => p.value !== null),
    [aligned]
  );

  return {
    series,
    aligned,
    isLoading: wti.isLoading || gasoline.isLoading || heatingOil.isLoading,
    isError: gasoline.isError || heatingOil.isError,
    wti,
    gasoline,
    heatingOil
  };
}
