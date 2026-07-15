// Display formatting helpers shared across panels.

export function formatCurrency(value, { decimals = 2 } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatNumber(value, { decimals = 2 } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/** Compacts large magnitudes, e.g. 425000 -> "425.0K", 1200000 -> "1.2M". */
export function formatCompactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value, { decimals = 2, showSign = true } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatSigma(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}σ`;
}

export function formatDate(dateString, { includeYear = true } = {}) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: includeYear ? 'numeric' : undefined
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** "3m ago" / "2h ago" style relative time for the last-updated indicator. */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'never';
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/** Tailwind color class for a signed value: green positive, red negative, muted zero/null. */
export function signColor(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-terminal-muted';
  if (value > 0) return 'text-bull';
  if (value < 0) return 'text-bear';
  return 'text-terminal-muted';
}
