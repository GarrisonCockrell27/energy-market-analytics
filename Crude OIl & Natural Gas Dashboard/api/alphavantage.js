// Generic proxy for the Alpha Vantage API (https://www.alphavantage.co/documentation/).
//
// The client calls /api/alphavantage?function=<AV function>&<params...> and
// this handler injects ALPHA_VANTAGE_API_KEY server-side so the key never
// reaches the browser.
export default async function handler(req, res) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ALPHA_VANTAGE_API_KEY is not configured on the server.' });
    return;
  }

  const { function: fn, ...params } = req.query || {};
  if (!fn) {
    res.status(400).json({ error: 'Missing "function" parameter.' });
    return;
  }

  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', fn);
  url.searchParams.set('apikey', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  try {
    const upstream = await fetch(url.toString());
    const body = await upstream.json();

    // Alpha Vantage returns HTTP 200 even for rate limits / bad params —
    // surface those as errors so hooks can fall back to cached data.
    if (body?.Note || body?.Information || body?.['Error Message']) {
      res.status(429).json({ error: 'Alpha Vantage limit or invalid request', detail: body });
      return;
    }

    res.status(200).json(body);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Alpha Vantage', detail: String(err?.message || err) });
  }
}
