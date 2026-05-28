// Proxy from the HUD voice loop to the OpenClaw brain. Keeps the brain URL
// (and optional auth token) out of client code, and lets the front-end
// gracefully fall back to its canned router when no brain is configured.
//
// Configure ONE of:
//   JARVIS_BRAIN_URL   full URL that accepts POST { message, session_id }
//                      and returns { reply } (or { response } / { text }).
//                      Recommended — works whether the brain is the FastAPI
//                      backend, OpenClaw directly, or any other thin shim.
//   OPENCLAW_API_URL   convenience: proxy calls OPENCLAW_API_URL + '/api/chat'
//
// Optional auth:
//   JARVIS_BRAIN_TOKEN sent as Bearer if set.
//
// If neither URL env is set, returns 503 and the client uses its canned brain.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = req.body && typeof req.body === 'object' ? req.body
    : (() => { try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; } })();

  const message = typeof body.message === 'string' ? body.message.slice(0, 4000) : '';
  const session_id = typeof body.session_id === 'string' ? body.session_id : '';
  if (!message) return res.status(400).json({ error: 'message required' });

  const url = process.env.JARVIS_BRAIN_URL
           || (process.env.OPENCLAW_API_URL
                 ? process.env.OPENCLAW_API_URL.replace(/\/+$/, '') + '/api/chat'
                 : '');
  if (!url) return res.status(503).json({ error: 'no brain configured' });

  const headers = { 'Content-Type': 'application/json' };
  const authToken = process.env.JARVIS_BRAIN_TOKEN;
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, session_id }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: 'brain upstream failed', status: r.status, detail: detail.slice(0, 500) });
    }
    const data = await r.json();
    // accept {reply,session_id} (FastAPI), {response}, {text}, {message}
    const reply = data.reply || data.response || data.text || data.message || '';
    return res.status(200).json({ reply, session_id: data.session_id || session_id });
  } catch (err) {
    return res.status(500).json({ error: 'brain proxy failed', detail: String(err).slice(0, 500) });
  }
}
