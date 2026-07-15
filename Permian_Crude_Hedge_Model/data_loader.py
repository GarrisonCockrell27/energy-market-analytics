"""
Loads historical WTI Cushing spot price data published by the U.S. Energy
Information Administration (EIA) and prepares it for use in the hedge model.

Data source: EIA Petroleum & Other Liquids, "Cushing, OK WTI Spot Price FOB"
(series RWTC), retrieved via the EIA Open Data API v2.
https://www.eia.gov/dnav/pet/hist/RWTCM.htm
"""

import pandas as pd

RAW_CSV_PATH = "data/eia_wti_monthly_raw.csv"
CLEAN_CSV_PATH = "data/eia_wti_monthly.csv"

SERIES_NAME = "Cushing, OK WTI Spot Price FOB (RWTC)"
SOURCE = "U.S. Energy Information Administration (EIA)"
SOURCE_URL = "https://www.eia.gov/dnav/pet/hist/RWTCM.htm"
UNITS = "Dollars per barrel ($/bbl)"
ORIGINAL_FREQUENCY = "Daily (aggregated by EIA to a monthly average)"
FREQUENCY_USED = "Monthly average"
RETRIEVAL_DATE = "2026-07-14"


def build_clean_csv(raw_path: str = RAW_CSV_PATH, clean_path: str = CLEAN_CSV_PATH) -> pd.DataFrame:
    """Reads the raw EIA API export and writes a tidy monthly CSV for the repo."""
    raw = pd.read_csv(raw_path)
    raw["Month"] = pd.to_datetime(raw["period"], format="%Y-%m")
    raw = raw.sort_values("Month").reset_index(drop=True)

    clean = pd.DataFrame({
        "Month": raw["Month"].dt.strftime("%Y-%m-%d"),
        "WTI_Cushing_Price_USD_per_BBL": raw["wti_cushing_price_usd_bbl"].astype(float),
        "Source": SOURCE,
        "Notes": "",
    })
    clean.to_csv(clean_path, index=False)
    return clean


def load_wti_data(clean_path: str = CLEAN_CSV_PATH) -> pd.DataFrame:
    """Loads the tidy monthly WTI Cushing price series."""
    df = pd.read_csv(clean_path, parse_dates=["Month"])
    return df


def load_wti_window(start: str, end: str, clean_path: str = CLEAN_CSV_PATH) -> pd.DataFrame:
    """Returns the WTI price series limited to an [start, end] monthly window."""
    df = load_wti_data(clean_path)
    mask = (df["Month"] >= pd.Timestamp(start)) & (df["Month"] <= pd.Timestamp(end))
    return df.loc[mask].reset_index(drop=True)


def get_metadata(df: pd.DataFrame) -> dict:
    """Summary metadata block used on the Historical WTI Data worksheet."""
    return {
        "series_name": SERIES_NAME,
        "source": SOURCE,
        "source_url": SOURCE_URL,
        "units": UNITS,
        "original_frequency": ORIGINAL_FREQUENCY,
        "frequency_used": FREQUENCY_USED,
        "date_range": f"{df['Month'].min().strftime('%B %Y')} - {df['Month'].max().strftime('%B %Y')}",
        "retrieval_date": RETRIEVAL_DATE,
    }


if __name__ == "__main__":
    cleaned = build_clean_csv()
    print(f"Wrote {len(cleaned)} monthly observations to {CLEAN_CSV_PATH}")
    print(cleaned.head())
    print(cleaned.tail())
