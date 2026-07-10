# Energy Market Analytics

Quantitative research projects analyzing commodity and energy market structure, price risk, and physical market fundamentals. Each project is self-contained with a Jupyter notebook and supporting data outputs.

Built by Garrison Cockrell — Economics student at Texas A&M University | Commercial Commodity Intern at S&P Global Energy

---

## Projects

### ERCOT Basis Risk & DA/RT Convergence Analysis
**`/ERCOT_Basis_Project`**

Analyzes ERCOT HB_NORTH and HB_WEST day-ahead and real-time settlement prices from January 2024 through June 2026, with a focus on DA/RT convergence risk, North-West hub basis behavior, and physical driver attribution.

**Key findings:**
- DA/RT convergence exposure is dominated by low-frequency, high-severity RTM price spikes — not average spread behavior
- The worst 1% of DA/RT outcomes occurred during net load averaging 48,000+ MW versus a 35,163 MW full-sample mean, with renewable share collapsing from 36% to 18%
- RTM North-West basis is materially more volatile than DAM North-West basis, with regional price divergence most severe in real-time market conditions
- Positive and negative RTM basis events reflect distinct physical regimes driven by renewable output and net load conditions

**Data sources:** ERCOT market data portal (DAM and RTM settlement point prices, generation by fuel type, system load)

**Tools:** Python, pandas, NumPy, matplotlib, scipy, statsmodels

---

## About

These projects are built for research and learning purposes. Findings represent historical market-risk attribution, not trading recommendations. Transaction costs, collateral requirements, and execution constraints are outside the scope of this work.# energy-market-analytics
