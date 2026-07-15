import { Fragment, useEffect, useMemo, useState } from 'react';
import { useWtiSpot, useHenryHubSpot } from '../hooks/useEIAData.js';
import { useOilGasRatioSeries, useCrackSpreadSeries } from '../hooks/useDerivedMarketData.js';
import { calculatePnL, calculateRiskReward, isValidTradeInput, summarizeClosedTrades } from '../utils/calculations.js';
import { formatCurrency, formatDateTime, formatPercent, formatNumber, signColor } from '../utils/formatters.js';
import { TRADE_INSTRUMENTS } from '../utils/instruments.js';

const STORAGE_KEY = 'crudeedge_trades';
const INSTRUMENT_OPTIONS = Object.keys(TRADE_INSTRUMENTS);
const TIME_HORIZONS = ['Intraday', 'Days', 'Weeks', 'Months'];

// Renamed from the original "Oil-Gas Spread" label to match the spec's
// exact terminology ("Oil-to-Gas Ratio," not "spread"). Old trades already
// saved under the previous label are remapped on load so existing paper
// trades and their P&L history aren't silently orphaned by the rename.
const LEGACY_INSTRUMENT_MAP = { 'Oil-Gas Spread': 'Oil-to-Gas Ratio' };

const emptyForm = {
  instrument: 'WTI Crude',
  direction: 'Long',
  entryPrice: '',
  size: '',
  stopPrice: '',
  targetPrice: '',
  timeHorizon: 'Days',
  thesis: '',
  catalyst: '',
  invalidation: ''
};

const emptyCloseForm = { exitPrice: '', exitRationale: '', lesson: '' };

function loadTrades() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((t) => ({ ...t, instrument: LEGACY_INSTRUMENT_MAP[t.instrument] ?? t.instrument }));
  } catch {
    return [];
  }
}

function saveTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function exportTradesAsJson(trades) {
  const blob = new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crudeedge-trades-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PaperTradeTracker() {
  const wti = useWtiSpot();
  const hh = useHenryHubSpot();
  const { series: ratioSeries } = useOilGasRatioSeries();
  const { series: crackSeries } = useCrackSpreadSeries();

  const [trades, setTrades] = useState(loadTrades);
  const [form, setForm] = useState(emptyForm);
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [closingId, setClosingId] = useState(null);
  const [closeForm, setCloseForm] = useState(emptyCloseForm);

  useEffect(() => saveTrades(trades), [trades]);

  // Every instrument's "current price" comes from the same shared,
  // date-aligned series every other tab uses (see useDerivedMarketData.js)
  // — a paper position on the ratio or crack proxy is marked using the
  // exact same synthetic value the Spread & Signals tab displays, never a
  // separately-recomputed one.
  const currentPriceFor = (instrument) => {
    if (instrument === 'WTI Crude') return wti.data?.[wti.data.length - 1]?.value ?? null;
    if (instrument === 'Henry Hub') return hh.data?.[hh.data.length - 1]?.value ?? null;
    if (instrument === 'Oil-to-Gas Ratio') return ratioSeries.length ? ratioSeries[ratioSeries.length - 1].ratio : null;
    if (instrument === 'Crack Spread') return crackSeries.length ? crackSeries[crackSeries.length - 1].value : null;
    return null;
  };

  const preview = useMemo(
    () =>
      calculateRiskReward({
        instrument: form.instrument,
        direction: form.direction,
        entryPrice: Number(form.entryPrice) || null,
        size: Number(form.size) || null,
        stopPrice: Number(form.stopPrice) || null,
        targetPrice: Number(form.targetPrice) || null
      }),
    [form.instrument, form.direction, form.entryPrice, form.size, form.stopPrice, form.targetPrice]
  );

  function handleSubmit(e) {
    e.preventDefault();
    const entryPrice = Number(form.entryPrice);
    const size = Number(form.size);
    if (!isValidTradeInput({ instrument: form.instrument, entryPrice, size })) return;

    const trade = {
      id: crypto.randomUUID(),
      instrument: form.instrument,
      direction: form.direction,
      entryPrice,
      size,
      stopPrice: form.stopPrice ? Number(form.stopPrice) : null,
      targetPrice: form.targetPrice ? Number(form.targetPrice) : null,
      contractMultiplier: TRADE_INSTRUMENTS[form.instrument].multiplier,
      thesis: form.thesis,
      catalyst: form.catalyst,
      invalidation: form.invalidation,
      timeHorizon: form.timeHorizon,
      createdAt: new Date().toISOString(),
      exitPrice: null,
      exitDate: null,
      exitRationale: '',
      lesson: '',
      status: 'open'
    };
    setTrades((prev) => [trade, ...prev]);
    setForm(emptyForm);
  }

  function openCloseDialog(trade) {
    setClosingId(trade.id);
    setCloseForm({ exitPrice: String(currentPriceFor(trade.instrument)?.toFixed(2) ?? ''), exitRationale: '', lesson: '' });
  }

  function confirmClose(id) {
    const exitPrice = Number(closeForm.exitPrice);
    if (!exitPrice) return;
    setTrades((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              exitPrice,
              exitDate: new Date().toISOString(),
              exitRationale: closeForm.exitRationale,
              lesson: closeForm.lesson,
              status: 'closed'
            }
          : t
      )
    );
    setClosingId(null);
  }

  function deleteTrade(id) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  const enrichedTrades = useMemo(
    () =>
      trades.map((t) => ({
        ...t,
        currentPrice: t.status === 'open' ? currentPriceFor(t.instrument) : null,
        pnl: calculatePnL(t, currentPriceFor(t.instrument))
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, wti.data, hh.data, ratioSeries, crackSeries]
  );

  const sortedTrades = useMemo(() => {
    const copy = [...enrichedTrades];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = new Date(a.createdAt) - new Date(b.createdAt);
      else if (sortBy === 'pnl') cmp = (a.pnl ?? 0) - (b.pnl ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [enrichedTrades, sortBy, sortDir]);

  const closedTrades = enrichedTrades.filter((t) => t.status === 'closed');
  const summary = useMemo(() => summarizeClosedTrades(closedTrades), [closedTrades]);
  const openUnrealizedPnl = enrichedTrades
    .filter((t) => t.status === 'open')
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  function toggleSort(field) {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortDir('desc');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="panel p-3">
          <div className="stat-label">Total Realized P&L</div>
          <div className={`text-xl font-semibold tabular ${signColor(summary.totalRealizedPnl)}`}>{formatCurrency(summary.totalRealizedPnl)}</div>
        </div>
        <div className="panel p-3">
          <div className="stat-label">Open Unrealized P&L</div>
          <div className={`text-xl font-semibold tabular ${signColor(openUnrealizedPnl)}`}>{formatCurrency(openUnrealizedPnl)}</div>
        </div>
        <div className="panel p-3">
          <div className="stat-label">Win Rate</div>
          <div className="text-xl font-semibold tabular">{summary.winRate !== null ? formatPercent(summary.winRate, { showSign: false }) : '—'}</div>
        </div>
        <div className="panel p-3">
          <div className="stat-label">Avg Winner / Loser</div>
          <div className="text-sm tabular">
            <span className="text-bull">{summary.avgWinner !== null ? formatCurrency(summary.avgWinner) : '—'}</span>
            {' / '}
            <span className="text-bear">{summary.avgLoser !== null ? formatCurrency(summary.avgLoser) : '—'}</span>
          </div>
        </div>
        <div className="panel p-3">
          <div className="stat-label">Profit Factor</div>
          <div className="text-xl font-semibold tabular">
            {summary.profitFactor === null ? '—' : summary.profitFactor === Infinity ? '∞' : formatNumber(summary.profitFactor)}
          </div>
        </div>
        <div className="panel p-3">
          <div className="stat-label">Expectancy / Trade</div>
          <div className={`text-xl font-semibold tabular ${signColor(summary.expectancy)}`}>
            {summary.expectancy !== null ? formatCurrency(summary.expectancy) : '—'}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span>NEW PAPER TRADE</span>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="stat-label">Instrument</span>
              <select value={form.instrument} onChange={(e) => setForm((f) => ({ ...f, instrument: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm">
                {INSTRUMENT_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="stat-label">Direction</span>
              <select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm">
                <option value="Long">Long</option>
                <option value="Short">Short</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="stat-label">Entry Price ({TRADE_INSTRUMENTS[form.instrument].priceUnit})</span>
              <input type="number" step="0.01" required value={form.entryPrice} onChange={(e) => setForm((f) => ({ ...f, entryPrice: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm tabular" placeholder="0.00" />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="stat-label">Size ({TRADE_INSTRUMENTS[form.instrument].sizeUnit})</span>
              <input type="number" step="1" required value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm tabular" placeholder="1" />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="stat-label">Stop Price</span>
              <input type="number" step="0.01" value={form.stopPrice} onChange={(e) => setForm((f) => ({ ...f, stopPrice: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm tabular" placeholder="optional" />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="stat-label">Target Price</span>
              <input type="number" step="0.01" value={form.targetPrice} onChange={(e) => setForm((f) => ({ ...f, targetPrice: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm tabular" placeholder="optional" />
            </label>
          </div>

          {(preview.maxRisk !== null || preview.estReward !== null) && (
            <div className="flex flex-wrap gap-4 text-xs border border-terminal-border rounded px-3 py-2 bg-zinc-900/50">
              <span>
                <span className="text-terminal-muted">Max Risk: </span>
                <span className="text-bear tabular">{preview.maxRisk !== null ? formatCurrency(preview.maxRisk) : '—'}</span>
                {!preview.stopValid && <span className="text-signal ml-1">⚠ stop is on the wrong side of entry</span>}
              </span>
              <span>
                <span className="text-terminal-muted">Est. Reward: </span>
                <span className="text-bull tabular">{preview.estReward !== null ? formatCurrency(preview.estReward) : '—'}</span>
                {!preview.targetValid && <span className="text-signal ml-1">⚠ target is on the wrong side of entry</span>}
              </span>
              <span>
                <span className="text-terminal-muted">Risk/Reward: </span>
                <span className="tabular">{preview.riskRewardRatio !== null ? `1 : ${preview.riskRewardRatio.toFixed(2)}` : '—'}</span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="stat-label">Time Horizon</span>
              <select value={form.timeHorizon} onChange={(e) => setForm((f) => ({ ...f, timeHorizon: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm">
                {TIME_HORIZONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="stat-label">Catalyst</span>
              <input type="text" value={form.catalyst} onChange={(e) => setForm((f) => ({ ...f, catalyst: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm" placeholder="What event/data point drives this?" />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="stat-label">Thesis</span>
            <textarea value={form.thesis} onChange={(e) => setForm((f) => ({ ...f, thesis: e.target.value }))} rows={2} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm resize-y" placeholder="Why this trade, in your own words?" />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="stat-label">Invalidation Condition</span>
            <input type="text" value={form.invalidation} onChange={(e) => setForm((f) => ({ ...f, invalidation: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm" placeholder="What would prove this thesis wrong?" />
          </label>

          <button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-700 border border-terminal-border rounded px-4 py-2 text-sm font-medium">
            Log Trade
          </button>
        </form>
      </div>

      <div className="panel overflow-x-auto">
        <div className="panel-header">
          <span>TRADE LOG</span>
          <button onClick={() => exportTradesAsJson(trades)} className="text-xs text-terminal-muted hover:text-terminal-text border border-terminal-border rounded px-2 py-0.5">
            Export JSON
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-terminal-muted text-xs uppercase border-b border-terminal-border">
              <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('date')}>
                Date {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-3 py-2">Instrument</th>
              <th className="px-3 py-2">Dir</th>
              <th className="px-3 py-2">Entry</th>
              <th className="px-3 py-2">Stop</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Mark / Exit</th>
              <th className="px-3 py-2 cursor-pointer" onClick={() => toggleSort('pnl')}>
                P&L {sortBy === 'pnl' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-3 py-2">Thesis</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sortedTrades.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-terminal-muted">
                  No trades logged yet.
                </td>
              </tr>
            ) : (
              sortedTrades.map((t) => (
                <Fragment key={t.id}>
                  <tr className="border-b border-terminal-border/60 hover:bg-zinc-900/50">
                    <td className="px-3 py-2 whitespace-nowrap tabular text-xs">{formatDateTime(t.createdAt)}</td>
                    <td className="px-3 py-2">{t.instrument}</td>
                    <td className={`px-3 py-2 ${t.direction === 'Long' ? 'text-bull' : 'text-bear'}`}>{t.direction}</td>
                    <td className="px-3 py-2 tabular">{t.entryPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 tabular text-terminal-muted">{t.stopPrice?.toFixed(2) ?? '—'}</td>
                    <td className="px-3 py-2 tabular text-terminal-muted">{t.targetPrice?.toFixed(2) ?? '—'}</td>
                    <td className="px-3 py-2 tabular">{t.size}</td>
                    <td className="px-3 py-2 tabular">{(t.status === 'open' ? t.currentPrice : t.exitPrice)?.toFixed(2) ?? '—'}</td>
                    <td className={`px-3 py-2 tabular font-medium ${signColor(t.pnl)}`}>{t.pnl !== null ? formatCurrency(t.pnl) : '—'}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate text-terminal-muted" title={t.thesis}>
                      {t.thesis || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs uppercase text-terminal-muted">{t.status}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {t.status === 'open' && closingId !== t.id && (
                        <button onClick={() => openCloseDialog(t)} className="text-xs text-signal hover:underline">
                          Close
                        </button>
                      )}
                      <button onClick={() => deleteTrade(t.id)} className="ml-2 text-xs text-bear hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                  {closingId === t.id && (
                    <tr className="border-b border-terminal-border/60 bg-zinc-900/40">
                      <td colSpan={11} className="px-3 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="stat-label">Exit Price</span>
                            <input type="number" step="0.01" value={closeForm.exitPrice} onChange={(e) => setCloseForm((f) => ({ ...f, exitPrice: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1 text-xs tabular" />
                          </label>
                          <label className="flex flex-col gap-1 text-xs sm:col-span-1">
                            <span className="stat-label">Exit Rationale</span>
                            <input type="text" value={closeForm.exitRationale} onChange={(e) => setCloseForm((f) => ({ ...f, exitRationale: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1 text-xs" placeholder="Why close now?" />
                          </label>
                          <label className="flex flex-col gap-1 text-xs sm:col-span-1">
                            <span className="stat-label">Post-Trade Lesson</span>
                            <input type="text" value={closeForm.lesson} onChange={(e) => setCloseForm((f) => ({ ...f, lesson: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1 text-xs" placeholder="What would you do differently?" />
                          </label>
                          <div className="flex gap-2">
                            <button onClick={() => confirmClose(t.id)} className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-terminal-border rounded px-3 py-1.5 text-bull">
                              Confirm Close
                            </button>
                            <button onClick={() => setClosingId(null)} className="text-xs text-terminal-muted hover:underline">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
