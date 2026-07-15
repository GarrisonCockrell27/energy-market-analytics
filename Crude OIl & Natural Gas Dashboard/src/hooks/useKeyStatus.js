import { useQuery } from '@tanstack/react-query';

/**
 * Which API keys are configured server-side (see api/keycheck.js) — never
 * the key values themselves. Drives both the onboarding gate (App.jsx) and
 * Data Health's NOT_CONFIGURED vs FAILED classification for optional
 * integrations (Alpha Vantage, FRED).
 */
export function useKeyStatus() {
  return useQuery({
    queryKey: ['keycheck'],
    queryFn: async () => {
      const res = await fetch('/api/keycheck');
      if (!res.ok) throw new Error('Key check failed');
      return res.json();
    },
    staleTime: Infinity,
    retry: false
  });
}
