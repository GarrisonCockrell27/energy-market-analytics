import { formatDateTime, formatRelativeTime } from '../utils/formatters.js';

const TABS = [
  { id: 'overview', label: 'Market Overview' },
  { id: 'signals', label: 'Spread & Signals' },
  { id: 'trades', label: 'Paper Trade Tracker' },
  { id: 'fundamentals', label: 'Fundamentals' }
];

export default function NavBar({ activeTab, onTabChange, lastUpdated }) {
  return (
    <header className="border-b border-terminal-border bg-terminal-panel sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">
            Crude<span className="text-signal">Edge</span>
          </span>
          <span className="text-[11px] uppercase tracking-widest text-terminal-muted border border-terminal-border rounded px-1.5 py-0.5">
            WTI / HH Terminal
          </span>
        </div>

        <nav className="flex items-center gap-1 font-mono text-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white border border-terminal-border'
                  : 'text-terminal-muted hover:text-terminal-text hover:bg-zinc-900 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="text-xs text-terminal-muted font-mono text-right">
          <div>
            LAST UPDATE:{' '}
            <span className="text-terminal-text">{lastUpdated ? formatRelativeTime(lastUpdated) : '—'}</span>
          </div>
          <div className="text-[10px]">{lastUpdated ? formatDateTime(lastUpdated) : ''}</div>
        </div>
      </div>
    </header>
  );
}
