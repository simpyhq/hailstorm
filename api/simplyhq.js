// Server-side proxy for the SimplyHQ portal.
// Keeps the portal password OUT of client code — set SIMPLYHQ_PASSWORD in your
// Vercel project env vars (Settings -> Environment Variables). Rotate the old
// password that was previously hardcoded in the client.
//
//   GET /api/simplyhq?resource=emails   -> recent emails
//   GET /api/simplyhq?resource=jobs     -> job/internship listings
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const password = process.env.SIMPLYHQ_PASSWORD;
  if (!password) {
    return res.status(500).json({ error: 'SIMPLYHQ_PASSWORD not configured' });
  }

  const RESOURCES = {
    emails: 'https://simpyhq.com/api/emails/recent',
    jobs: 'https://simpyhq.com/api/jobs/listings',
  };
  const resource = String(req.query.resource || 'emails');
  const target = RESOURCES[resource];
  if (!target) {
    return res.status(400).json({ error: 'unknown resource' });
  }

  try {
    const loginRes = await fetch('https://simpyhq.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!loginRes.ok) {
      return res.status(502).json({ error: 'portal login failed' });
    }

    // Forward the session cookie set by the login response.
    const cookie = loginRes.headers.get('set-cookie') || '';
    const dataRes = await fetch(target, { headers: cookie ? { Cookie: cookie } : {} });
    if (!dataRes.ok) {
      return res.status(502).json({ error: 'portal fetch failed' });
    }

    const data = await dataRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SimplyHQ data', details: String(err) });
  }
}
