# CrudeEdge

A dark-theme, terminal-style analytical dashboard and paper-trading journal for **WTI Crude Oil** (primary)
and **Henry Hub Natural Gas** (secondary), backed entirely by free, no-credit-card-required data APIs (EIA,
optionally Alpha Vantage and FRED).

## 1. What it does

CrudeEdge is a focused WTI/Henry Hub research workflow, not an attempted Bloomberg replacement. It covers four
areas: **Market Overview** (spot prices, the oil-to-gas ratio, weekly inventory), **Spread & Signals** (the
ratio's statistical distribution, an indicative crack-spread proxy, historical futures-curve shape),
**Fundamentals** (production, storage, refinery utilization, exports — for both WTI and Henry Hub — plus a
structured weekly market thesis journal), and a **Paper Trade Journal** (risk-controlled trade log with
pre-trade risk/reward sizing and real P&L math).

## 2. Why I built it

I wanted a project that forces the same discipline a junior energy analyst or trading-desk associate has to
apply to real market data: know exactly which series you're looking at (spot vs. futures, which exact EIA
series ID), align time series correctly before doing arithmetic on them, treat a discontinued data feed as
discontinued rather than silently stale, and size risk *before* placing a trade rather than after. Those are
also the exact classes of bug that showed up during development — a ratio that read differently on two tabs
because two price series weren't date-aligned, a futures curve quietly two years stale being shown next to a
live spot price, a real (not fake) natural gas price spike that looked like a data error until traced against
the raw EIA response. Fixing those for real, rather than hiding them, is most of what this project actually is.

## 3. Screenshots

Not included as static images in this repo — the fastest way to see it is to run it locally (see Setup below)
and open all four tabs; every panel is self-labeling (source, series ID, unit, observation date), so it reads
clearly without narration. If you're viewing this on GitHub and want a quick look before cloning, ask the
author for a live demo link.

## 4. Core features

- **Market Overview** — WTI and Henry Hub spot price panels (1D/1W/1M change, 52-week range, range-selectable
  chart), the date-aligned oil-to-gas ratio with a z-score/percentile signal, weekly crude inventory (with
  Cushing), and optional DXY/10Y macro context.
- **Spread & Signals** — 90-day/1-year oil-to-gas ratio distribution with ±1σ/±2σ bands and percentile, an
  "Indicative Spot 3:2:1 Crack Proxy" with its excluded cost factors spelled out, and a clearly-labeled
  **historical** WTI futures curve-shape card (EIA discontinued this feed in April 2024).
- **Fundamentals** — WTI: production, commercial + Cushing inventory (vs. 5-year range), refinery utilization,
  crude exports. Henry Hub: working gas in storage vs. 5-year range, weekly injection/withdrawal. Each panel
  states its unit, source, series ID, observation date, and why a trader watches it.
- **Weekly Market Thesis** — a structured, timestamped journal (bias, supply/demand read, catalysts, risks,
  invalidation conditions, conclusion) with a browsable history of prior weeks. Nothing here is AI-generated —
  every field is written by the user.
- **Paper Trade Journal** — WTI/Henry Hub outrights, plus the oil-to-gas ratio and crack-spread proxy as
  tradeable synthetic instruments. Every trade carries entry/stop/target, thesis, catalyst, invalidation
  condition, and (on close) exit rationale and a post-trade lesson. Live pre-trade risk/reward preview.
  Realized/unrealized P&L, win rate, avg winner/loser, profit factor, and expectancy. JSON export.
- **Data Health** — every data source is classified as CURRENT, STALE, HISTORICAL, NOT_CONFIGURED, FAILED, or
  UNAVAILABLE — never silently blurred together — grouped into core/historical/optional tiers with a one-line
  summary.

## 5. Technology stack

- **React 18 + Vite 5** — client app
- **Tailwind CSS** — dark zinc/slate terminal theme (green = bullish, red = bearish, amber = neutral)
- **Recharts** — all charting (line, composed/area range-bands)
- **TanStack Query (React Query) v5** — data fetching, 5-minute background auto-refresh, stale-while-revalidate caching
- **Vercel serverless functions** (`/api`) — proxy all third-party API calls so keys never reach the browser
- **Vitest** — unit tests for all quantitative logic

## 6. Architecture summary

Data flows in one direction: **API proxy → fetch hook → derived-data hook (alignment/math) → component
(presentation only)**.

- `api/*.js` — thin serverless proxies (EIA, Alpha Vantage, FRED). Inject the relevant API key server-side,
  forward the request, return JSON. No business logic lives here.
- `src/hooks/useEIAData.js`, `useAlphaVantage.js`, `useFRED.js` — one React Query hook per raw series. Series
  IDs are read from `src/utils/instruments.js`, never hardcoded per-hook.
- `src/hooks/useDerivedMarketData.js` — the oil-to-gas ratio and crack-spread proxy are each computed **once**,
  here, from date-aligned inputs, and consumed by every component that needs them (Market Overview, Spread &
  Signals, the Paper Trade Journal). This is deliberate: the original version of this app computed the ratio
  independently in three places, and two of those computations weren't date-aligned, so the same "current
  ratio" read differently depending which tab you were on. Centralizing it is the actual fix.
- `src/utils/calculations.js` — pure functions only: z-score, percentile, ratio bands, crack spread, contango/
  backwardation, P&L, risk/reward, seasonal averaging. No React, no fetching — this is what's unit tested.
- `src/utils/dataQuality.js` — turns a React Query result + instrument metadata into one of six honest health
  states (see §14).
- `src/utils/instruments.js` — the single source of truth for every series' name, EIA series ID, unit, source,
  series type, frequency, tier (core/historical/optional), and (for paper trades) contract multiplier.
- `src/components/*.jsx` — presentation only. No calculation logic lives in a component; if you're editing a
  number's *math*, you're in `calculations.js`, not a `.jsx` file.

## 7. Data sources

| Source | Required? | Used for |
|---|---|---|
| **EIA API v2** | Yes | WTI/Henry Hub spot, crude inventory (national + Cushing), crude production, refinery utilization, crude exports, Henry Hub storage, gasoline/heating oil spot, historical WTI futures curve |
| **Alpha Vantage** | No (optional) | Independent WTI/Henry Hub price cross-check only — never used in any calculation |
| **FRED** | No (optional) | DXY (broad dollar index proxy) and 10-Year Treasury yield, for macro context only |

All three are free with no credit card required. See §16 for how to get keys.

## 8. Instrument definitions

Every series has one canonical definition in `src/utils/instruments.js`, e.g.:

```js
wtiSpot: {
  name: 'WTI Cushing Spot',
  seriesId: 'PET.RWTC.D',
  unit: '$/bbl',
  source: 'EIA',
  seriesType: 'spot',
  frequency: 'daily',
  tier: 'core'
}
```

Paper-trade instruments have a parallel `TRADE_INSTRUMENTS` registry with contract multipliers: WTI Crude
(1,000 bbl/contract), Henry Hub (10,000 MMBtu/contract), and the Oil-to-Gas Ratio / Crack Spread proxies
(flat $ notional per point — they're multi-leg observations tracked as one synthetic number, not listed
contracts).

## 9. Spot vs. futures — why this distinction is enforced everywhere

Every price panel is labeled with its `seriesType` (spot, continuous-future, index, yield). This matters
because this app's own history has a concrete example of what happens when you don't: an earlier build showed
a WTI futures "near/far month" card that looked live, but EIA had actually stopped publishing that dataset in
April 2024 — the card was silently showing 2+ year old data next to a real-time spot price, ~$17 apart, with
no indication either way. The fix wasn't a smarter number; it was refusing to present the futures card as
anything other than **HISTORICAL**, with an explicit "not comparable to today's spot price" note. See
`src/utils/instruments.js` (`discontinuedAfter` field) and the Spread & Signals tab.

## 10. Oil-to-gas ratio methodology

**Formula:** `WTI Cushing Spot ($/bbl) ÷ Henry Hub Spot ($/MMBtu)`, using EIA series `PET.RWTC.D` and
`NG.RNGWHHD.D`.

Because WTI and Henry Hub don't always publish on the same calendar day, the two series are **inner-joined on
shared observation dates first** (`buildRatioSeries` in `calculations.js`) — the ratio is never computed from
each series' independently-latest point, which is what caused the original cross-tab inconsistency bug. The
dashboard then reports:

- **Mean / standard deviation** over the selected window (90-day or 1-year — recomputed per window, not a
  rolling lookback)
- **Z-score** — how many standard deviations the current reading sits from that mean
- **Percentile** — the distribution-shape-free complement to z-score
- A probabilistic label (NEUTRAL / ELEVATED / DEPRESSED / STATISTICALLY UNUSUAL), never a directive like "buy"
  or "sell"

## 11. Crack-spread methodology

Labeled **"Indicative Spot 3:2:1 Crack Proxy"** — deliberately not called a tradeable crack spread. Formula:

```
((2 × gasoline $/gal × 42) + (1 × heating oil $/gal × 42) − (3 × WTI $/bbl)) ÷ 3
```

expressed in $/bbl of crude, using EIA's free daily NY Harbor gasoline (`EER_EPMRU_PF4_Y35NY_DPG`) and heating
oil (`EER_EPD2F_PF4_Y35NY_DPG`) spot prices alongside WTI. All three legs are date-aligned (`alignSeriesByDate`)
before netting, for the same reason as the ratio above. It explicitly **excludes**: refinery operating costs,
actual refinery yields (real refineries don't produce a fixed 2:1 gasoline:distillate ratio), transportation,
quality/location basis, financing, and execution/hedging costs — it's a directional proxy, not a P&L estimate.

## 12. Fundamental-data methodology

Seasonal comparisons (crude inventory, Henry Hub storage) bucket each weekly observation into a week-of-year
index (1-52; the rare 53rd week folds into bucket 52 rather than creating an almost-always-empty bucket),
average/min/max every non-current year per bucket, and plot the current year's line against that 5-year
mean/range band. Week-of-year bucketing uses UTC date components throughout — an earlier version mixed
UTC-based day-of-year math with local-timezone year extraction, which silently shifted dates near January 1st
into the wrong year/bucket in timezones behind UTC. Caught by a unit test, fixed in `seasonalAverageByWeek`.

## 13. Paper-trade P&L methodology

`P&L = (mark − entry) × direction × size × contract multiplier`, where `direction` is +1 for Long / −1 for
Short and the multiplier comes from the single `TRADE_INSTRUMENTS` registry (never hardcoded per trade). A
WTI outright is always valued in 1,000-bbl contract terms; Henry Hub in 10,000-MMBtu terms; the ratio/crack
synthetic instruments in flat notional-per-point terms — so a multi-leg observation is never priced as if it
were a single listed contract. Pre-trade risk/reward (`calculateRiskReward`) computes max dollar risk, estimated
reward, and the R:R ratio from entry/stop/target before the trade is even logged, and flags a stop or target
placed on the wrong side of entry. Closed-trade stats (win rate, avg winner/loser, profit factor, expectancy)
are computed from realized P&L only; open positions are marked at the same live series every other tab uses.

## 14. Data-quality controls

Every fetched series passes through `checkSeries`/`describeQueryHealth` (`src/utils/dataQuality.js`), which
assigns exactly one of six states:

| Status | Meaning |
|---|---|
| `CURRENT` | Fresh data, latest refresh succeeded |
| `STALE` | Has data, but either the last refresh failed (showing last-known-good) or the observation is older than its frequency's expected cadence |
| `HISTORICAL` | Source-side discontinuation (e.g. EIA's futures feed) — real data, never presented as live |
| `NOT_CONFIGURED` | Optional integration (Alpha Vantage/FRED), credential missing — never counted as a failure |
| `FAILED` | A source that should be working (core, or optional-and-configured) has no usable data |
| `UNAVAILABLE` | No data and no error (not yet fetched) |

`checkSeries` also flags duplicate dates, non-monotonic dates, out-of-range values (per-instrument
`plausibleRange`), and extreme one-day jumps — the last of which caught a real, verified Henry Hub cold-snap
price spike (Jan 2026: $4.11 → $6.88 in one day) that's now flagged with a ⚠ and explanation rather than either
hidden or left looking like an unexplained data error.

## 15. Setup instructions

```bash
git clone <this-repo>
cd crudeEdge
npm install
cp .env.example .env.local   # fill in your keys, see below
npm run dev
```

Open http://localhost:5173. The Vite dev server includes a built-in plugin (`vite.config.js`) that runs the
same `/api/*` handlers Vercel uses in production, so local dev and a real deploy behave identically.

## 16. Environment variables

| Variable | Required | Get it at |
|---|---|---|
| `EIA_API_KEY` | **Yes** | https://www.eia.gov/opendata/register.php |
| `ALPHA_VANTAGE_API_KEY` | No | https://www.alphavantage.co/support/#api-key |
| `FRED_API_KEY` | No | https://fred.stlouisfed.org/docs/api/api_key.html |

All free, no credit card. Copy `.env.example` to `.env.local` and fill these in — `.env.local` is gitignored
and read **server-side only** (see `api/*.js`), never bundled into client JavaScript.

## 17. Testing commands

```bash
npm run test        # run the vitest suite once
npm run test:watch  # watch mode
npm run lint         # ESLint (flat config, eslint.config.js)
npm run build        # production build
```

63 unit tests cover date alignment, oil-to-gas ratio, z-score, percentile, crack spread, contango/
backwardation, contract-code resolution, long/short P&L with correct multipliers, risk/reward validation,
trade-form validation, profit factor/expectancy, seasonal averaging, and the full data-health status enum —
including edge cases (no overlapping dates, zero standard deviation, duplicate/non-monotonic dates, a single
observation, a missing latest value, out-of-range values). No TypeScript is configured in this project, so
there is no separate type-check step.

## 18. Deployment instructions

Push to GitHub, import into Vercel, and add the environment variables from §16 in the Vercel project settings.
`vercel.json` and the `api/` functions handle the rest — `npm run build` must succeed with no committed
credentials, which is verified before every commit in this repo's history.

## 19. Known limitations

- **No live futures curve.** EIA discontinued its free futures dataset in April 2024; no other free,
  no-credential provider was integrated. Adding one (e.g. a paid CME/ICE feed) would require documenting the
  provider, coverage, cost, and licensing terms before wiring it in — not done here by design.
- **Henry Hub fundamentals beyond storage** (dry-gas production, HDD/CDD, LNG feedgas) are marked
  `UNAVAILABLE` rather than faked — no dependable free source was integrated for these.
- **Rig count** is marked `UNAVAILABLE` — Baker Hughes' feed requires a licensed data agreement.
- **Alpha Vantage's free tier** caps at 25 requests/day; its hooks refresh every 30 minutes (not the app's
  default 5) to stay under that, and it's shown purely as an independent cross-check, never used in any
  calculation.
- **No automated screenshots** are checked into this repo (see §3).

## 20. Disclaimer

CrudeEdge is an educational and analytical project. It is **not investment advice**. Public data sources may be
delayed, revised, or discontinued without notice (see §9 for a real example). The Paper Trade Journal is a
practice tool — its results do not represent live execution, real slippage, real fills, or real transaction
costs, and should never be treated as a track record.
