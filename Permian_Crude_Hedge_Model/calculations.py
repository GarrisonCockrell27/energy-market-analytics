"""
Pure Python versions of the hedge math used in the Excel workbook.

These mirror the worksheet formulas exactly (see README "Core Formulas") so
they can be unit tested with hand-calculated examples. The workbook itself
recomputes everything with live Excel formulas -- this module is not used to
pre-calculate values that get pasted into the sheet.
"""


def midland_physical_price(wti_price: float, midland_basis: float) -> float:
    """Midland physical price = WTI Cushing price + Midland basis."""
    return wti_price + midland_basis


def actual_production(forecast_production: float, actual_pct: float) -> float:
    """Actual production = Forecast production x Actual production %."""
    return forecast_production * actual_pct


def hedged_volume(forecast_production: float, hedge_pct: float) -> float:
    """Hedged volume = Forecast production x Hedge percentage."""
    return forecast_production * hedge_pct


def over_hedged_volume(hedged_vol: float, actual_prod: float) -> float:
    """Over-hedged volume = MAX(Hedged volume - Actual production, 0)."""
    return max(hedged_vol - actual_prod, 0.0)


def physical_revenue(actual_prod: float, midland_price: float) -> float:
    """Physical revenue = Actual production x Midland physical price."""
    return actual_prod * midland_price


def wti_swap_pnl(hedged_vol: float, fixed_swap_price: float, wti_price: float) -> float:
    """WTI swap P&L = Hedged volume x (Fixed swap price - WTI price)."""
    return hedged_vol * (fixed_swap_price - wti_price)


def basis_hedge_pnl(hedged_vol: float, locked_basis: float, actual_basis: float) -> float:
    """Basis hedge P&L = Hedged volume x (Locked basis - Actual basis)."""
    return hedged_vol * (locked_basis - actual_basis)


def net_revenue(phys_revenue: float, hedge_pnl: float = 0.0) -> float:
    """Net revenue = Physical revenue + applicable hedge P&L."""
    return phys_revenue + hedge_pnl


def net_realized_price(net_rev: float, actual_prod: float) -> float:
    """Net realized price = Net revenue / Actual production."""
    if actual_prod == 0:
        return 0.0
    return net_rev / actual_prod
