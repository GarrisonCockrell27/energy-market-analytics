// Central instrument/series metadata registry. Every hook that fetches a
// time series should have exactly one entry here, and every component that
// displays a series should read its labeling (name, unit, series type) from
// this file rather than hardcoding strings — that's what keeps "spot" vs
// "futures" vs "index" from silently getting blurred together across tabs.
//
// `plausibleRange` is used by dataQuality.js to flag suspicious prices. It
// is deliberately wide — e.g. WTI spot went negative on 2020-04-20, so a
// naive "price can't be negative" rule would have been wrong — and exists
// to catch obvious garbage (typos, unit slips), not to second-guess real
// market moves.
//
// `tier` drives Data Health's grouping and its "X/Y core current" summary:
//   - 'core'      free, no-credential EIA series the dashboard depends on
//   - 'historical' a source EIA has discontinued — never a live signal
//   - 'optional'  a paid-tier-free but credentialed integration (Alpha
//                 Vantage, FRED) that enhances the view but isn't required
//
// `requiresKey` names the env var key (see api/keycheck.js) that must be
// configured for this instrument to work; null means EIA (already required
// to use the app at all, see App.jsx's onboarding gate).
export const INSTRUMENTS = {
  wtiSpot: {
    name: 'WTI Cushing Spot',
    seriesId: 'PET.RWTC.D',
    commodity: 'Crude Oil',
    unit: '$/bbl',
    source: 'EIA',
    seriesType: 'spot',
    frequency: 'daily',
    timezone: 'America/New_York',
    plausibleRange: [-50, 300],
    tier: 'core',
    requiresKey: null
  },
  henryHubSpot: {
    name: 'Henry Hub Natural Gas Spot',
    seriesId: 'NG.RNGWHHD.D',
    commodity: 'Natural Gas',
    unit: '$/MMBtu',
    source: 'EIA',
    seriesType: 'spot',
    frequency: 'daily',
    timezone: 'America/New_York',
    plausibleRange: [0, 50],
    tier: 'core',
    requiresKey: null
  },
  crudeInventory: {
    name: 'US Commercial Crude Ending Stocks (ex-SPR)',
    seriesId: 'PET.WCESTUS1.W',
    commodity: 'Crude Oil',
    unit: 'thousand bbl',
    source: 'EIA',
    seriesType: 'stock-level',
    frequency: 'weekly',
    timezone: 'America/New_York',
    plausibleRange: [0, 2000000],
    tier: 'core',
    requiresKey: null,
    traderNote: 'The headline weekly crude balance figure — the single most-watched number in the Wednesday EIA release.'
  },
  cushingInventory: {
    name: 'Cushing, OK Crude Ending Stocks (ex-SPR)',
    seriesId: 'PET.W_EPC0_SAX_YCUOK_MBBL.W',
    commodity: 'Crude Oil',
    unit: 'thousand bbl',
    source: 'EIA',
    seriesType: 'stock-level',
    frequency: 'weekly',
    timezone: 'America/New_York',
    plausibleRange: [0, 100000],
    tier: 'core',
    requiresKey: null,
    traderNote: 'Cushing is the WTI futures delivery point — low Cushing stocks can pressure the front of the curve independent of national balances.'
  },
  refineryUtilization: {
    name: 'US Refinery Operable Capacity Utilization',
    seriesId: 'PET.WPULEUS3.W',
    commodity: 'Crude Oil',
    unit: '%',
    source: 'EIA',
    seriesType: 'utilization-rate',
    frequency: 'weekly',
    timezone: 'America/New_York',
    plausibleRange: [0, 100],
    tier: 'core',
    requiresKey: null,
    traderNote: 'Refinery runs drive crude demand — falling utilization (maintenance, outages) softens crude demand and tends to build crude stocks even if consumption is fine.'
  },
  crudeExports: {
    name: 'US Crude Oil Exports',
    seriesId: 'PET.WCREXUS2.W',
    commodity: 'Crude Oil',
    unit: 'thousand bbl/day',
    source: 'EIA',
    seriesType: 'flow-volume',
    frequency: 'weekly',
    timezone: 'America/New_York',
    plausibleRange: [0, 10000],
    tier: 'core',
    requiresKey: null,
    traderNote: 'Exports are a release valve for domestic oversupply — rising exports can offset a domestic build that would otherwise look bearish.'
  },
  crudeProduction: {
    name: 'US Field Production of Crude Oil',
    seriesId: 'PET.WCRFPUS2.W',
    commodity: 'Crude Oil',
    unit: 'thousand bbl/day',
    source: 'EIA',
    seriesType: 'production-volume',
    frequency: 'weekly',
    timezone: 'America/New_York',
    plausibleRange: [0, 50000],
    tier: 'core',
    requiresKey: null,
    traderNote: 'The supply side of the balance — sustained production growth is a standing bearish undertone even through short-term demand swings.'
  },
  henryHubStorage: {
    name: 'Lower 48 Working Natural Gas in Storage',
    seriesId: 'NG.NW2_EPG0_SWO_R48_BCF.W',
    commodity: 'Natural Gas',
    unit: 'Bcf',
    source: 'EIA',
    seriesType: 'stock-level',
    frequency: 'weekly',
    timezone: 'America/New_York',
    plausibleRange: [0, 6000],
    tier: 'core',
    requiresKey: null,
    traderNote: 'The gas-market equivalent of the crude inventory report — storage vs. the 5-year range is the primary seasonal supply/demand gauge for Henry Hub.'
  },
  wtiFutContract1: {
    name: 'WTI Futures — Front Month (Contract 1)',
    seriesId: 'PET.RCLC1.D',
    commodity: 'Crude Oil',
    unit: '$/bbl',
    source: 'EIA',
    seriesType: 'continuous-future',
    frequency: 'daily',
    timezone: 'America/New_York',
    plausibleRange: [-50, 300],
    tier: 'historical',
    requiresKey: null,
    // EIA stopped publishing its entire petroleum/pri/fut futures dataset
    // on this date (confirmed via the dataset's own endPeriod metadata) —
    // this is a permanent, source-side discontinuation, not a fetch bug.
    discontinuedAfter: '2024-04-05'
  },
  wtiFutContract4: {
    name: 'WTI Futures — 4th Month Out (Contract 4)',
    seriesId: 'PET.RCLC4.D',
    commodity: 'Crude Oil',
    unit: '$/bbl',
    source: 'EIA',
    seriesType: 'continuous-future',
    frequency: 'daily',
    timezone: 'America/New_York',
    plausibleRange: [-50, 300],
    tier: 'historical',
    requiresKey: null,
    discontinuedAfter: '2024-04-05'
  },
  gasolineSpot: {
    name: 'NY Harbor Conventional Gasoline Spot',
    seriesId: 'PET.EER_EPMRU_PF4_Y35NY_DPG.D',
    commodity: 'Gasoline',
    unit: '$/gal',
    source: 'EIA',
    seriesType: 'spot',
    frequency: 'daily',
    timezone: 'America/New_York',
    plausibleRange: [0, 10],
    tier: 'core',
    requiresKey: null
  },
  heatingOilSpot: {
    name: 'NY Harbor No. 2 Heating Oil Spot',
    seriesId: 'PET.EER_EPD2F_PF4_Y35NY_DPG.D',
    commodity: 'Heating Oil',
    unit: '$/gal',
    source: 'EIA',
    seriesType: 'spot',
    frequency: 'daily',
    timezone: 'America/New_York',
    plausibleRange: [0, 10],
    tier: 'core',
    requiresKey: null
  },
  avWti: {
    name: 'WTI Crude (Alpha Vantage)',
    seriesId: 'WTI',
    commodity: 'Crude Oil',
    unit: '$/bbl',
    source: 'Alpha Vantage',
    // Alpha Vantage's own docs don't specify whether this is a spot quote,
    // a futures settle, or a blended benchmark — treat it as a
    // methodologically distinct series from EIA's spot price rather than
    // assume equivalence. It's shown as an independent cross-check only,
    // never mixed into any calculation.
    seriesType: 'unspecified (independent cross-check only)',
    frequency: 'daily',
    timezone: 'unspecified',
    plausibleRange: [-50, 300],
    tier: 'optional',
    requiresKey: 'alphaVantage',
    requiresKeyEnvVar: 'ALPHA_VANTAGE_API_KEY'
  },
  avNaturalGas: {
    name: 'Henry Hub Natural Gas (Alpha Vantage)',
    seriesId: 'NATURAL_GAS',
    commodity: 'Natural Gas',
    unit: '$/MMBtu',
    source: 'Alpha Vantage',
    seriesType: 'unspecified (independent cross-check only)',
    frequency: 'daily',
    timezone: 'unspecified',
    plausibleRange: [0, 50],
    tier: 'optional',
    requiresKey: 'alphaVantage',
    requiresKeyEnvVar: 'ALPHA_VANTAGE_API_KEY'
  },
  dxy: {
    name: 'Broad Dollar Index (DXY proxy)',
    seriesId: 'DTWEXBGS',
    commodity: 'FX Index',
    unit: 'index',
    source: 'FRED',
    seriesType: 'index',
    frequency: 'daily',
    timezone: 'America/New_York',
    plausibleRange: [50, 250],
    tier: 'optional',
    requiresKey: 'fred',
    requiresKeyEnvVar: 'FRED_API_KEY'
  },
  dgs10: {
    name: '10-Year Treasury Yield',
    seriesId: 'DGS10',
    commodity: 'Rates',
    unit: '%',
    source: 'FRED',
    seriesType: 'yield',
    frequency: 'daily',
    timezone: 'America/New_York',
    plausibleRange: [-1, 20],
    tier: 'optional',
    requiresKey: 'fred',
    requiresKeyEnvVar: 'FRED_API_KEY'
  }
};

// --- Paper Trade Journal instrument definitions ---------------------------
// Centralizes contract multipliers, size units, and price units for every
// supported paper-trade type, so P&L math (calculations.js) and the trade
// form's labels can never drift apart. "Oil-to-Gas Ratio" and "Crack
// Spread" are multi-leg observations tracked as a single synthetic number
// (the ratio/spread value itself), not a real listed contract — sized in
// notional units, not futures contracts, and labeled as such in the form.
export const TRADE_INSTRUMENTS = {
  'WTI Crude': {
    multiplier: 1000,
    sizeUnit: 'contracts (1,000 bbl each)',
    priceUnit: '$/bbl',
    legType: 'outright'
  },
  'Henry Hub': {
    multiplier: 10000,
    sizeUnit: 'contracts (10,000 MMBtu each)',
    priceUnit: '$/MMBtu',
    legType: 'outright'
  },
  'Oil-to-Gas Ratio': {
    multiplier: 1,
    sizeUnit: '$ notional per ratio point',
    priceUnit: 'ratio (unitless)',
    legType: 'multi-leg observation (WTI ÷ Henry Hub)'
  },
  'Crack Spread': {
    multiplier: 1,
    sizeUnit: '$ notional per $/bbl',
    priceUnit: '$/bbl',
    legType: 'multi-leg observation (indicative 3:2:1 proxy)'
  }
};
