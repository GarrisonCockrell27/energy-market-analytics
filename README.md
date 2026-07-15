# energy-market-analytics

Two independent, data-driven energy market projects — one a live analytical dashboard, one a financial hedging model — both built on free, public data sources (primarily the EIA Open Data API).

## Projects

### [Crude oil & Natrual Gas Dashboard](./Crude oil & Natural Gas Dashboard)
A dark-theme, terminal-style analytical dashboard and paper-trading journal for WTI Crude Oil and Henry Hub Natural Gas. Covers market overview, spread/signal analysis (oil-to-gas ratio, crack-spread proxy), fundamentals (production, storage, refinery utilization), a weekly market thesis journal, and a risk-controlled paper trade tracker with real P&L math.

**Stack:** JavaScript (React 18, Vite), Tailwind CSS, Recharts, TanStack Query, Vitest — see [full README](./crudeEdge/README.md) for architecture, methodology, and setup.

### [Permian Crude Hedge & Basis Risk Model](./Permian_Crude_Hedge_Model)
An educational Excel model examining how a hypothetical Permian Basin crude producer is exposed to WTI benchmark-price risk, Midland-Cushing basis risk, and production-volume risk — and how a WTI fixed-price swap and a combined basis hedge change that exposure.

**Stack:** Python (data pipeline, formula-driven workbook build, pytest suite), Excel — see [full README](./Permian_Crude_Hedge_Model/README.md) for methodology, formulas, and key findings.

## Why these two together

Both projects work through the same core question from different angles: how public commodity-market data translates into commercial and trading decisions. CrudeEdge is the live-market, signal-monitoring side; the hedge model is the fundamental risk-management side. Together they cover reading current market conditions and reasoning about exposure to future ones.

## Disclaimer

Both projects are educational and analytical. Neither constitutes investment advice or a live trading track record — see each project's own README for its specific disclaimers and limitations.
