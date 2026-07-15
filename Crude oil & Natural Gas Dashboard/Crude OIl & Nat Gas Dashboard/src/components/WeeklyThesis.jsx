import { useEffect, useState } from 'react';
import { formatDateTime } from '../utils/formatters.js';

const STORAGE_KEY = 'crudeedge_thesis_entries';
const BIAS_OPTIONS = ['Bullish', 'Neutral', 'Bearish'];

function emptyEntry() {
  return {
    id: crypto.randomUUID(),
    weekEnding: new Date().toISOString().slice(0, 10),
    wtiBias: 'Neutral',
    henryHubBias: 'Neutral',
    supplyRead: '',
    demandRead: '',
    keyFundamentals: '',
    catalysts: '',
    risks: '',
    invalidation: '',
    tradesMonitored: '',
    conclusion: '',
    createdAt: null,
    updatedAt: null
  };
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

const BIAS_STYLE = {
  Bullish: 'text-bull',
  Bearish: 'text-bear',
  Neutral: 'text-terminal-muted'
};

/**
 * Structured weekly market thesis journal — deliberately not an AI-written
 * commentary generator. Every field is the user's own analysis; this
 * component only stores, timestamps, and lets them review prior weeks.
 */
export default function WeeklyThesis() {
  const [entries, setEntries] = useState(loadEntries);
  const [draft, setDraft] = useState(emptyEntry);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => saveEntries(entries), [entries]);

  function handleSave() {
    const now = new Date().toISOString();
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === draft.id);
      const record = { ...draft, createdAt: draft.createdAt ?? now, updatedAt: now };
      return exists ? prev.map((e) => (e.id === draft.id ? record : e)) : [record, ...prev];
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  function handleNew() {
    setDraft(emptyEntry());
  }

  function handleLoad(entry) {
    setDraft(entry);
  }

  function handleDelete(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (draft.id === id) setDraft(emptyEntry());
  }

  const field = (key, label, { textarea = false, rows = 2, placeholder = '' } = {}) => (
    <label className="flex flex-col gap-1 text-xs">
      <span className="stat-label">{label}</span>
      {textarea ? (
        <textarea
          value={draft[key]}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          rows={rows}
          placeholder={placeholder}
          className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm resize-y font-mono"
        />
      ) : (
        <input
          type="text"
          value={draft[key]}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          placeholder={placeholder}
          className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm"
        />
      )}
    </label>
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <span>WEEKLY MARKET THESIS</span>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-[10px] text-bull">Saved</span>}
          <button onClick={handleNew} className="text-xs text-terminal-muted hover:text-terminal-text border border-terminal-border rounded px-2 py-0.5">
            New Entry
          </button>
          <button onClick={handleSave} className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-terminal-border rounded px-2 py-1">
            Save
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="stat-label">Week Ending</span>
            <input
              type="date"
              value={draft.weekEnding}
              onChange={(e) => setDraft((d) => ({ ...d, weekEnding: e.target.value }))}
              className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm tabular"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="stat-label">WTI Bias</span>
            <select value={draft.wtiBias} onChange={(e) => setDraft((d) => ({ ...d, wtiBias: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm">
              {BIAS_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="stat-label">Henry Hub Bias</span>
            <select value={draft.henryHubBias} onChange={(e) => setDraft((d) => ({ ...d, henryHubBias: e.target.value }))} className="bg-zinc-900 border border-terminal-border rounded px-2 py-1.5 text-sm">
              {BIAS_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('supplyRead', 'Supply Read', { textarea: true, placeholder: 'Production, inventory, exports…' })}
          {field('demandRead', 'Demand Read', { textarea: true, placeholder: 'Refinery runs, seasonal demand…' })}
        </div>

        {field('keyFundamentals', 'Key Fundamentals', { textarea: true, placeholder: 'What data points matter most this week?' })}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('catalysts', 'Major Catalysts', { placeholder: 'EIA report, OPEC meeting, weather…' })}
          {field('risks', 'Major Risks', { placeholder: 'What could go wrong with this read?' })}
        </div>

        {field('invalidation', 'Invalidation Conditions', { placeholder: 'What would prove this week’s thesis wrong?' })}
        {field('tradesMonitored', 'Trades Being Monitored', { placeholder: 'Reference open paper trades or setups' })}
        {field('conclusion', 'Conclusion', { textarea: true, rows: 3, placeholder: 'Bottom line for the week' })}
      </div>

      {entries.length > 0 && (
        <div className="border-t border-terminal-border">
          <div className="px-3 py-1.5 text-[10px] tracking-wider text-terminal-muted bg-zinc-900/60">PRIOR ENTRIES</div>
          <div className="divide-y divide-terminal-border/60 max-h-64 overflow-y-auto">
            {entries
              .slice()
              .sort((a, b) => new Date(b.weekEnding) - new Date(a.weekEnding))
              .map((e) => (
                <div key={e.id} className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-zinc-900/50 text-xs">
                  <button onClick={() => handleLoad(e)} className="flex-1 text-left">
                    <span className="tabular text-terminal-text">{e.weekEnding}</span>{' '}
                    <span className={BIAS_STYLE[e.wtiBias]}>WTI {e.wtiBias}</span> /{' '}
                    <span className={BIAS_STYLE[e.henryHubBias]}>HH {e.henryHubBias}</span>
                    {e.conclusion && <span className="text-terminal-muted"> — {e.conclusion.slice(0, 80)}</span>}
                    <div className="text-[10px] text-terminal-muted">
                      Saved {e.updatedAt ? formatDateTime(e.updatedAt) : '—'}
                    </div>
                  </button>
                  <button onClick={() => handleDelete(e.id)} className="text-bear hover:underline flex-shrink-0">
                    Delete
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
