// Generic proxy for the EIA API v2 (https://www.eia.gov/opendata/documentation.php).
//
// The client never talks to api.eia.gov directly and never sees EIA_API_KEY.
// It calls /api/eia?route=<v2 route>&<eia query params...> and this function
// re-attaches the key server-side before forwarding the request.
//
// `route` is restricted to the petroleum/natural-gas namespaces this app
// actually needs, so the proxy can't be turned into an open relay for
// arbitrary EIA (or other) traffic.
const ALLOWED_ROUTE_PREFIXES = ['petroleum/', 'natural-gas/', 'seriesid/'];

export default async function handler(req, res) {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'EIA_API_KEY is not configured on the server.' });
    return;
  }

  const { route, ...params } = req.query || {};
  if (!route || !ALLOWED_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    res.status(400).json({ error: 'Missing or disallowed "route" parameter.' });
    return;
  }

  const url = new URL(`https://api.eia.gov/v2/${route}`);
  url.searchParams.set('api_key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  try {
    const upstream = await fetch(url.toString());
    const body = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'EIA API error', detail: body });
      return;
    }
    res.status(200).json(body);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach EIA API', detail: String(err?.message || err) });
  }
}
