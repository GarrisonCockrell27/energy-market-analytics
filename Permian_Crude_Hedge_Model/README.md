# Permian Crude Producer Hedge & Basis Risk Model

An educational, student-built Excel model that looks at how a hypothetical Permian
Basin crude oil producer is exposed to WTI benchmark-price risk, Midland-Cushing
basis risk, and production-volume risk -- and how a couple of basic hedge
strategies change that exposure. This is a simplified commercial-analysis
exercise, not a professional recommendation or trading tool.

## Commercial question

How do WTI prices, Midland basis, and production uncertainty affect a Permian
producer's revenue, and how do basic hedge strategies change that exposure?

**Core takeaway:** a WTI fixed-price swap reduces benchmark-price risk, but
Midland basis risk and production uncertainty can still remain.

## Workbook structure

`Permian_Crude_Hedge_Model.xlsx` has five worksheets:

1. **Executive Summary** -- purpose, disclosure, a strategy comparison table, key
   findings, the main remaining risk per strategy, two live charts, and a short
   conclusion.
2. **Inputs & Assumptions** -- every editable assumption (production, hedge %,
   swap price, basis levels, analysis dates), clearly split from the one
   real/observed data series and from the calculated outputs.
3. **Historical WTI Data** -- the real EIA monthly WTI Cushing price history,
   with a metadata block (source, units, frequency, date range, retrieval date).
4. **Hedge Calculations** -- a monthly, formula-driven table (Jul-2023 to
   Jun-2026) comparing all three strategies side by side, plus summary metrics.
5. **Stress Scenarios** -- three shocks applied to the base case, with a
   change-from-base-case comparison.

All dollar figures, hedge P&L, and net realized prices are calculated with live
Excel formulas (`INDEX`/`MATCH`, `SUM`, `AVERAGE`, `MIN`, `MAX`, `IF`, `EDATE`) --
nothing is pre-computed in Python and pasted in as a static value. There are no
macros or VBA.

## Data source

- **Series:** Cushing, OK WTI Spot Price FOB (EIA series `RWTC`)
- **Source:** U.S. Energy Information Administration (EIA), retrieved via the
  public EIA Open Data API v2
- **Units:** Dollars per barrel ($/bbl)
- **Original frequency:** Daily, aggregated by EIA to a monthly average
- **Frequency used in workbook:** Monthly average
- **Date range pulled:** January 1986 - June 2026
- **Retrieval date:** 2026-07-14
- `data/eia_wti_monthly_raw.csv` is the raw API export; `data/eia_wti_monthly.csv`
  is the tidy version used to build the workbook.

The Midland-Cushing basis is **not** a real data series here -- there is no
public, free historical Midland price feed used in this project. The basis is a
clearly labeled illustrative assumption (`Midland price = WTI Cushing + basis`).
A more-negative basis means Midland crude sells below Cushing WTI.

## Strategies compared

1. **Unhedged** -- physical revenue only, fully exposed to WTI and basis moves.
2. **WTI Fixed-Price Swap** -- hedges a share of forecast production at a fixed
   WTI price. Gains when WTI falls, loses when WTI rises, and leaves Midland
   basis risk unresolved.
3. **WTI Swap + Midland Basis Hedge** -- adds a basis hedge on top of the swap.
   Gains when the basis weakens (more negative) versus the locked level, loses
   when it strengthens. Production shortfalls can still leave part of the hedge
   without matching physical barrels ("over-hedged volume").

## Core formulas

```
Midland physical price   = WTI Cushing price + Midland basis
Actual production        = Forecast production x Actual production %
Hedged volume             = Forecast production x Hedge %
Over-hedged volume        = MAX(Hedged volume - Actual production, 0)
Physical revenue          = Actual production x Midland physical price
WTI swap P&L              = Hedged volume x (Fixed swap price - WTI price)
Basis hedge P&L           = Hedged volume x (Locked basis - Actual basis)
Net revenue               = Physical revenue + applicable hedge P&L
Net realized price        = Net revenue / Actual production
```

## Rebuilding the workbook

```bash
pip install -r requirements.txt
python data_loader.py     # regenerates data/eia_wti_monthly.csv from the raw EIA export
python build_model.py     # builds Permian_Crude_Hedge_Model.xlsx
```

## Running the tests

```bash
python -m pytest tests/ -v
```

Six tests hand-check the core formulas (Midland physical price, physical
revenue, WTI swap P&L, basis hedge P&L, net realized price, and the
production-shortfall/over-hedging case) in `calculations.py`, a pure-Python
mirror of the Excel formulas used only for testing.

## Key limitations

- The producer, production volumes, hedge percentages, swap price, and basis
  levels are entirely hypothetical -- only the WTI price history is real data.
- The Midland-Cushing basis is a single static assumption per scenario, not a
  modeled or historical relationship.
- The model is a simplified monthly comparison, not a forward-curve or
  probability-weighted risk model. It does not use options, Value-at-Risk, or
  any stochastic simulation.
- Stress scenarios apply a single shock to average base-case conditions rather
  than re-running the full 36-month grid, to keep the analysis easy to follow.

## What I learned

Working through this project clarified a few things about how Permian
producers actually get paid for their oil. Midland crude doesn't trade at the
WTI Cushing price you see quoted everywhere -- it trades at WTI *plus* a
location differential (the basis) that reflects pipeline capacity and
takeaway constraints out of the Permian. That's why a producer's realized
price is really two separate risks stacked on top of each other: the
benchmark itself moving, and the local discount widening or narrowing
independently of the benchmark.

That distinction is also why a plain WTI fixed-price swap doesn't fully
protect a producer. The swap settles against WTI, so it does a good job of
smoothing out benchmark moves, but if the Midland discount widens, the swap
has nothing to say about that -- the producer still eats the loss on their
physical barrels. You need a separate basis hedge to address that piece.

The production-shortfall scenario was the one that surprised me most. A
hedge is a fixed number of barrels locked in based on a forecast, but actual
production doesn't always hit the forecast. If production falls short, the
hedge doesn't shrink to match -- so part of it ends up "over-hedged," meaning
the producer is settling a swap on volume they didn't actually produce. That's
part of why producers typically hedge less than 100% of forecast production:
hedging a smaller share leaves room for the forecast to be wrong without
turning the hedge itself into a new source of risk.
