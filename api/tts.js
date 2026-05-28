// Server-side TTS proxy for the HUD voice loop.
// Provider order: ElevenLabs (if ELEVENLABS_API_KEY) -> OpenAI TTS (if
// OPENAI_API_KEY) -> 503 (client then falls back to browser speechSynthesis).
//
// Env vars (set in Vercel project -> Settings -> Environment Variables):
//   ELEVENLABS_API_KEY     primary provider
//   ELEVENLABS_VOICE_ID    optional, defaults to "Adam"
//   OPENAI_API_KEY         optional fallback
//   OPENAI_TTS_VOICE       optional, defaults to "onyx"
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : (() => {
    try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
  })();
  const text = typeof body.text === 'string' ? body.text.slice(0, 2000) : '';
  const voiceOverride = typeof body.voice === 'string' ? body.voice : '';
  if (!text) return res.status(400).json({ error: 'text required' });

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    // helper: pipe a web ReadableStream to the Node response chunk by chunk
    async function pipeAudio(upstream) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200);
      const reader = upstream.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    }

    if (elevenKey) {
      const voiceId = voiceOverride || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // "Adam"
      // /stream + optimize_streaming_latency = fastest time-to-first-byte
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      });
      if (!r.ok) {
        const detail = await r.text();
        return res.status(502).json({ error: 'elevenlabs failed', status: r.status, detail });
      }
      await pipeAudio(r.body);
      return;
    }

    if (openaiKey) {
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
      if (!r.ok) {
        const detail = await r.text();
        return res.status(502).json({ error: 'openai tts failed', status: r.status, detail });
      }
      await pipeAudio(r.body);
      return;
    }

    return res.status(503).json({ error: 'no TTS provider configured' });
  } catch (err) {
    return res.status(500).json({ error: 'tts failed', detail: String(err) });
  }
}
