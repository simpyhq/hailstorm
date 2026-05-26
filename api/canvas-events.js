// Token lives in Vercel env vars now — set CANVAS_TOKEN (and rotate the old one
// that was previously hardcoded here).
const CANVAS_TOKEN = process.env.CANVAS_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (!CANVAS_TOKEN) {
    return res.status(500).json({ error: 'CANVAS_TOKEN not configured' });
  }
  try {
    const response = await fetch(
      'https://canvas.ou.edu/api/v1/users/self/upcoming_events?per_page=10',
      { headers: { Authorization: `Bearer ${CANVAS_TOKEN}` } }
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Canvas data' });
  }
}
