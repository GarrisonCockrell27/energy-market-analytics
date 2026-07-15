// Derives real NYMEX-style WTI (CL) contract identifiers and human-readable
// delivery-month labels from an "as of" trade date, using the standard CME
// WTI expiry rule: trading in a contract ends ~3 business days before the
// 25th calendar day of the month before its delivery month.
//
// This is a calendar approximation (it uses 3 calendar days, not 3 business
// days, and ignores holidays) — good enough to resolve which delivery month
// a "front month" or "N-th month out" quote refers to, which is all this
// app needs. It does NOT fabricate a live contract: it labels whatever
// historical date the underlying observation actually carries, so a quote
// from a discontinued 2024 data feed is correctly labeled with a 2024
// contract code, not today's.
const MONTH_CODES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function approxExpiry(deliveryYear, deliveryMonthIndex0) {
  // Month prior to delivery month
  const priorMonthIndex0 = deliveryMonthIndex0 === 0 ? 11 : deliveryMonthIndex0 - 1;
  const priorYear = deliveryMonthIndex0 === 0 ? deliveryYear - 1 : deliveryYear;
  const twentyFifth = new Date(Date.UTC(priorYear, priorMonthIndex0, 25));
  return new Date(twentyFifth.getTime() - 3 * 24 * 60 * 60 * 1000);
}

/** Resolves the front-month (contract 1) delivery year/month for a given trade date. */
function resolveFrontMonth(asOfDate) {
  let year = asOfDate.getUTCFullYear();
  let monthIndex0 = asOfDate.getUTCMonth();

  for (let i = 0; i < 6; i++) {
    if (asOfDate <= approxExpiry(year, monthIndex0)) {
      return { year, monthIndex0 };
    }
    monthIndex0 += 1;
    if (monthIndex0 > 11) {
      monthIndex0 = 0;
      year += 1;
    }
  }
  // Should be unreachable given the loop bound, but fail safe rather than throw.
  return { year, monthIndex0 };
}

/**
 * Returns { ticker, label, deliveryYear, deliveryMonthIndex0 } for the given
 * NYMEX WTI "contract number" (1 = front month, 4 = fourth month out) as of
 * a specific historical trade date string (YYYY-MM-DD).
 */
export function getContractInfo(asOfDateString, contractNumber = 1) {
  const asOfDate = new Date(`${asOfDateString}T00:00:00Z`);
  const front = resolveFrontMonth(asOfDate);

  let monthIndex0 = front.monthIndex0 + (contractNumber - 1);
  let year = front.year;
  while (monthIndex0 > 11) {
    monthIndex0 -= 12;
    year += 1;
  }

  return {
    ticker: `CL${MONTH_CODES[monthIndex0]}${String(year).slice(-2)}`,
    label: `${MONTH_NAMES[monthIndex0]} ${year}`,
    deliveryYear: year,
    deliveryMonthIndex0: monthIndex0
  };
}
