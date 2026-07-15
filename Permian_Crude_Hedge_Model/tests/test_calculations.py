"""
Simple hand-calculated tests for the hedge math in calculations.py.
Run with: python -m pytest tests/ -v
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import calculations as calc


def test_midland_physical_price():
    # WTI = $70/bbl, basis = -$2/bbl -> Midland price = $68/bbl
    assert calc.midland_physical_price(70.0, -2.0) == 68.0


def test_physical_revenue():
    # Midland price = $68/bbl, actual production = 1,000 bbl -> revenue = $68,000
    price = calc.midland_physical_price(70.0, -2.0)
    revenue = calc.physical_revenue(1000.0, price)
    assert revenue == 68000.0


def test_wti_swap_pnl_when_wti_falls():
    # Hedged volume = 10,000 bbl, fixed swap = $75, actual WTI falls to $65
    # Swap gains: 10,000 x (75 - 65) = $100,000
    pnl = calc.wti_swap_pnl(10000.0, 75.0, 65.0)
    assert pnl == 100000.0


def test_wti_swap_pnl_when_wti_rises():
    # Hedged volume = 10,000 bbl, fixed swap = $75, actual WTI rises to $85
    # Swap loses: 10,000 x (75 - 85) = -$100,000
    pnl = calc.wti_swap_pnl(10000.0, 75.0, 85.0)
    assert pnl == -100000.0


def test_basis_hedge_pnl_when_basis_weakens():
    # Hedged volume = 10,000 bbl, locked basis = -$1.50, actual basis weakens to -$5.00
    # Basis hedge gains: 10,000 x (-1.50 - (-5.00)) = $35,000
    pnl = calc.basis_hedge_pnl(10000.0, -1.50, -5.00)
    assert pnl == 35000.0


def test_net_realized_price():
    # Physical revenue = $68,000, swap P&L = $5,000, actual production = 1,000 bbl
    # Net revenue = $73,000 -> net realized price = $73.00/bbl
    net_rev = calc.net_revenue(68000.0, 5000.0)
    price = calc.net_realized_price(net_rev, 1000.0)
    assert net_rev == 73000.0
    assert price == 73.0


def test_production_shortfall_creates_over_hedging():
    # Forecast production = 50,000 bbl, hedge 70% -> hedged volume = 35,000 bbl
    # Actual production falls to 80% of forecast -> 40,000 bbl (still above hedge)
    forecast = 50000.0
    hedged = calc.hedged_volume(forecast, 0.70)
    actual_80pct = calc.actual_production(forecast, 0.80)
    assert hedged == 35000.0
    assert actual_80pct == 40000.0
    assert calc.over_hedged_volume(hedged, actual_80pct) == 0.0

    # A deeper shortfall to 60% of forecast -> 30,000 bbl actual, below the
    # 35,000 bbl hedged volume, creating 5,000 bbl of over-hedged exposure.
    actual_60pct = calc.actual_production(forecast, 0.60)
    assert calc.over_hedged_volume(hedged, actual_60pct) == 5000.0
