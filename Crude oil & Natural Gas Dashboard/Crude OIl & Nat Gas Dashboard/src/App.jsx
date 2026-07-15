import { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import NavBar from './components/NavBar.jsx';
import MarketOverview from './components/MarketOverview.jsx';
import SpreadSignals from './components/SpreadSignals.jsx';
import PaperTradeTracker from './components/PaperTradeTracker.jsx';
import FundamentalsTab from './components/FundamentalsTab.jsx';
import { useKeyStatus } from './hooks/useKeyStatus.js';

const TAB_COMPONENTS = {
  overview: MarketOverview,
  signals: SpreadSignals,
  trades: PaperTradeTracker,
  fundamentals: FundamentalsTab
};

function OnboardingScreen({ keyStatus }) {
  const rows = [
    { key: 'eia', label: 'EIA_API_KEY', url: 'https://www.eia.gov/opendata/register.php', purpose: 'Crude/nat-gas prices, inventory, production, futures curve', required: true },
    { key: 'alphaVantage', label: 'ALPHA_VANTAGE_API_KEY', url: 'https://www.alphavantage.co/support/#api-key', purpose: 'WTI & Henry Hub commodity time series cross-check', required: false },
    { key: 'fred', label: 'FRED_API_KEY', url: 'https://fred.stlouisfed.org/docs/api/api_key.html', purpose: 'DXY proxy & 10Y Treasury yield macro context', required: false }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-xl w-full panel p-6">
        <h1 className="text-xl font-semibold mb-1">
          Crude<span className="text-signal">Edge</span> needs API keys
        </h1>
        <p className="text-sm text-terminal-muted mb-4">
          This is a real market data terminal — there's no mock data mode. <code className="text-terminal-text">EIA_API_KEY</code> is
          required since every panel is built on EIA data; Alpha Vantage and FRED are optional add-ons for a
          price cross-check and macro context. Add keys to <code className="text-terminal-text">.env.local</code> and
          restart the dev server (or redeploy on Vercel) to get live data.
        </p>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="flex items-start gap-3 border border-terminal-border rounded p-3">
              <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${keyStatus?.[r.key] ? 'bg-bull' : 'bg-bear'}`} />
              <div className="text-sm">
                <div className="font-mono">
                  {r.label} {r.required && <span className="text-bear text-[10px] align-middle">REQUIRED</span>}
                </div>
                <div className="text-terminal-muted text-xs">{r.purpose}</div>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-signal hover:underline">
                  Get a free key →
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-terminal-muted mt-4">
          See the README for full setup instructions.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [lastUpdated, setLastUpdated] = useState(null);
  const isFetching = useIsFetching();
  const keyStatusQuery = useKeyStatus();

  useEffect(() => {
    if (isFetching === 0) setLastUpdated(Date.now());
  }, [isFetching]);

  const ActiveComponent = TAB_COMPONENTS[activeTab];
  const keyStatus = keyStatusQuery.data;
  // EIA backs every panel (prices, inventory, production, futures curve) —
  // Alpha Vantage and FRED only add a cross-check price and macro context,
  // so the app is only usable once the EIA key specifically is present.
  const eiaConfigured = Boolean(keyStatus?.eia);

  if (keyStatusQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-terminal-muted">Loading CrudeEdge…</div>;
  }

  if (!eiaConfigured) {
    return <OnboardingScreen keyStatus={keyStatus} />;
  }

  return (
    <div className="min-h-screen">
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} lastUpdated={lastUpdated} />
      <main className="max-w-[1600px] mx-auto px-4 py-4">
        <ActiveComponent />
      </main>
    </div>
  );
}
