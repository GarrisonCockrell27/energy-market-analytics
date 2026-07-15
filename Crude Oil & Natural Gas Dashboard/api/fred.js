// Generic proxy for the FRED API (https://fred.stlouisfed.org/docs/api/fred/).
//
// The client calls /api/fred?series_id=DTWEXBGS&<params...> and this handler
// injects FRED_API_KEY server-side. Only the `series_observations` endpoint
// is exposed since that's all this app needs (DXY, 10Y yield).
export default async function handler(req, res) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'FRED_API_KEY is not configured on the server.' });
    return;
  }

  const { series_id: seriesId, ...params } = req.query || {};
  if (!seriesId) {
    res.status(400).json({ error: 'Missing "series_id" parameter.' });
    return;
  }

  const url = new URL('https://api.stlouisfed.org/fred/series/observations');
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  try {
    const upstream = await fetch(url.toString());
    const body = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'FRED API error', detail: body });
      return;
    }
    res.status(200).json(body);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach FRED API', detail: String(err?.message || err) });
  }
}
