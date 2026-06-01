// Server-side TTS proxy for the HUD voice loop.
// Provider cascade — tries providers in order, falls through on failure so a
// single provider going down (billing, quota, rate limit, transient 5xx)
// never kills voice as long as a second provider is configured.
//   1. ElevenLabs   (if ELEVENLABS_API_KEY) — preferred for "Jarvis" voice
//   2. OpenAI TTS   (if OPENAI_API_KEY)     — used as fallback (or primary
//                                              if no ElevenLabs key)
// Both fail or neither set -> 503 and the client drops to browser
// speechSynthesis. Voice always works.
//
// Response headers (for the client + debugging):
//   X-TTS-Provider   which provider actually supplied the audio
//   X-TTS-Fallback   '1' if the first-choice provider failed
//   X-TTS-Note       short human reason when a fallback was used
//
// Env:
//   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID   (voice id defaults to "Adam")
//   OPENAI_API_KEY, OPENAI_TTS_VOICE          (voice defaults to "onyx")

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = req.body && typeof req.body === 'object' ? req.body
    : (() => { try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; } })();
  const text = typeof body.text === 'string' ? body.text.slice(0, 2000) : '';
  const voiceOverride = typeof body.voice === 'string' ? body.voice : '';
  if (!text) return res.status(400).json({ error: 'text required' });

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  async function callEleven() {
    if (!elevenKey) return { skip: true };
    const voiceId = voiceOverride || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3`,
        {
          method: 'POST',
          headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
          }),
        },
      );
      if (r.ok) return { ok: true, provider: 'elevenlabs', upstream: r.body };
      const detail = await r.text();
      return { ok: false, provider: 'elevenlabs', status: r.status, detail };
    } catch (err) {
      return { ok: false, provider: 'elevenlabs', status: 0, detail: String(err) };
    }
  }

  async function callOpenAI() {
    if (!openaiKey) return { skip: true };
    try {
      const r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'tts-1',
          voice: voiceOverride || process.env.OPENAI_TTS_VOICE || 'onyx',
          input: text,
          response_format: 'mp3',
        }),
      });
      if (r.ok) return { ok: true, provider: 'openai', upstream: r.body };
      const detail = await r.text();
      return { ok: false, provider: 'openai', status: r.status, detail };
    } catch (err) {
      return { ok: false, provider: 'openai', status: 0, detail: String(err) };
    }
  }

  function describeElevenFailure(status, detail) {
    // ElevenLabs returns billing/quota errors as 401 with a JSON body that
    // mentions 'quota_exceeded' or similar; surface a useful one-liner.
    const d = (detail || '').toLowerCase();
    if (status === 401 && /quota|exceed|payment|billing/.test(d)) return 'ElevenLabs quota/billing exhausted — fell back to OpenAI';
    if (status === 401) return 'ElevenLabs auth failed (invalid key?) — fell back to OpenAI';
    if (status === 402) return 'ElevenLabs payment required — fell back to OpenAI';
    if (status === 429) return 'ElevenLabs rate-limited — fell back to OpenAI';
    return `ElevenLabs ${status} — fell back to OpenAI`;
  }

  async function pipe(upstream) {
    res.status(200);
    const reader = upstream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  }

  const tried = [];

  try {
    // 1) ElevenLabs
    const e = await callEleven();
    if (e.ok) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Provider', 'elevenlabs');
      await pipe(e.upstream);
      return;
    }
    if (!e.skip) {
      tried.push(e);
      console.warn('[tts] elevenlabs failed', e.status, (e.detail || '').slice(0, 240));
    }

    // 2) OpenAI (as primary or as fallback)
    const o = await callOpenAI();
    if (o.ok) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Provider', 'openai');
      if (tried.length) {
        res.setHeader('X-TTS-Fallback', '1');
        const prev = tried[0];
        res.setHeader('X-TTS-Note', describeElevenFailure(prev.status, prev.detail));
      }
      await pipe(o.upstream);
      return;
    }
    if (!o.skip) {
      tried.push(o);
      console.warn('[tts] openai failed', o.status, (o.detail || '').slice(0, 240));
    }

    // 3) nothing worked — let the client drop to browser TTS
    return res.status(tried.length ? 502 : 503).json({
      error: tried.length ? 'all TTS providers failed' : 'no TTS provider configured',
      attempts: tried.map((a) => ({
        provider: a.provider,
        status: a.status,
        detail: (a.detail || '').slice(0, 300),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'tts failed', detail: String(err) });
  }
}
