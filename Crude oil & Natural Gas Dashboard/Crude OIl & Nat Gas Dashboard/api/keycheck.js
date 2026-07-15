// Lets the client ask "which API keys are configured?" without ever
// exposing the key values themselves. Used to drive the onboarding screen.
export default async function handler(req, res) {
  res.status(200).json({
    eia: Boolean(process.env.EIA_API_KEY),
    alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
    fred: Boolean(process.env.FRED_API_KEY)
  });
}
