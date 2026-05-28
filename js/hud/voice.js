/* voice.js — Phase 2 Step 1: push-to-talk + premium TTS + canned HUD brain.
   Flow:  user clicks VOX (or hits backtick)  ->  STT (browser SpeechRecognition)
          ->  orb 'listening' / transcript bubble  ->  brain stub (router on
          HUD data + tab/brief commands)  ->  TTS (POST /api/tts -> ElevenLabs
          or OpenAI; falls back to browser speechSynthesis on file:// or when
          no provider key is set)  ->  orb 'speaking' until audio ends.
   The brain stub is intentionally swap-ready for OpenClaw later (just point
   `respond()` at POST /chat instead of `router()`). */
(function (J) {
  'use strict';

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const Synth = window.speechSynthesis;

  let rec = null;
  let audio = null;
  let listening = false;
  let speaking = false;

  /* ---- visual state plumbing ---- */
  function setMode(mode) {
    const cls = ['v-idle', 'v-listen', 'v-process', 'v-speak'];
    document.body.classList.remove(...cls);
    document.body.classList.add('v-' + (mode === 'idle' ? 'idle' : mode));
    if (J.orb && J.orb.setState) {
      // map UI mode -> orb state; 'idle'|'listening'|'processing'|'speaking' map 1:1
      J.orb.setState(mode === 'listen' ? 'listening' : mode === 'process' ? 'processing' : mode === 'speak' ? 'speaking' : 'idle');
    }
  }

  function showTranscript(text, cls) {
    const el = J.$('voice-transcript');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('listening', 'speaking');
    if (cls) el.classList.add(cls);
    el.classList.add('show');
  }
  function hideTranscript(delay) {
    const el = J.$('voice-transcript');
    if (!el) return;
    clearTimeout(hideTranscript._t);
    hideTranscript._t = setTimeout(() => el.classList.remove('show', 'listening', 'speaking'), delay || 0);
  }

  /* ---- speech recognition (in) ---- */
  function setupRec() {
    if (!SpeechRec) return null;
    const r = new SpeechRec();
    r.continuous = false;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (e) => {
      const results = Array.from(e.results);
      const transcript = results.map((x) => x[0].transcript).join('').trim();
      const final = results[results.length - 1].isFinal;
      showTranscript(transcript || '…', 'listening');
      if (final) {
        listening = false;
        setMode('process');
        showTranscript(transcript, 'listening');
        handle(transcript);
      }
    };
    r.onerror = (e) => {
      listening = false;
      setMode('idle');
      hideTranscript(800);
      // common: 'not-allowed' (mic denied), 'no-speech' (silence)
      if (e && e.error === 'not-allowed') showTranscript('Mic blocked. Allow microphone in the address bar.', 'speaking');
    };
    r.onend = () => {
      if (listening) {                    // ended without a final result
        listening = false;
        setMode('idle');
        hideTranscript(500);
      }
    };
    return r;
  }

  function listen() {
    if (speaking) {                       // user cut in mid-reply
      try { audio && audio.pause(); } catch (_) {}
      try { Synth && Synth.cancel(); } catch (_) {}
      speaking = false;
    }
    if (!rec) rec = setupRec();
    if (!rec) { speak("Voice input isn't supported in this browser."); return; }
    if (listening) return;
    listening = true;
    setMode('listen');
    showTranscript('…', 'listening');
    try { rec.start(); } catch (_) {}     // 'already started' is fine
  }

  function cancel() {
    try { rec && rec.stop(); } catch (_) {}
    try { audio && audio.pause(); } catch (_) {}
    try { Synth && Synth.cancel(); } catch (_) {}
    listening = false; speaking = false;
    setMode('idle');
    hideTranscript(200);
  }

  /* ---- text to speech (out) ---- */
  async function speak(text) {
    if (!text) return;
    speaking = true;
    setMode('speak');
    showTranscript('› ' + text, 'speaking');

    // 1) try the premium proxy
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audio = new Audio(url);
        audio.onended = () => { speaking = false; setMode('idle'); hideTranscript(400); URL.revokeObjectURL(url); };
        audio.onerror = () => { speakFallback(text); URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch (_) { /* fall through */ }

    // 2) browser speech synthesis fallback (works on file:// and without keys)
    speakFallback(text);
  }

  function speakFallback(text) {
    if (!Synth) { speaking = false; setMode('idle'); hideTranscript(400); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02; u.pitch = 0.85; u.volume = 1;
    const voices = Synth.getVoices();
    const pref = voices.find((v) => /Daniel|Alex|Google UK English Male|Microsoft (David|Mark)/i.test(v.name))
              || voices.find((v) => /male/i.test(v.name))
              || voices[0];
    if (pref) u.voice = pref;
    u.onend = () => { speaking = false; setMode('idle'); hideTranscript(400); };
    Synth.cancel();
    Synth.speak(u);
  }

  /* ---- brain stub (swap to OpenClaw later: replace router() with a fetch
          to your backend /chat endpoint) ---- */
  function txt(id) { const e = J.$(id); return e ? e.textContent.trim() : ''; }
  function clickTab(name) { document.querySelector(`.sb-btn[data-tab="${name}"]`)?.click(); }

  function router(input) {
    const q = (input || '').toLowerCase();
    if (!q) return "I didn't catch that.";

    if (/\b(jarvis|hello|hey|hi)\b/.test(q) && q.length < 30) return 'At your service, sir.';
    if (/\b(thank|thanks)\b/.test(q)) return 'My pleasure.';

    if (/\b(time|clock)\b/.test(q)) {
      const t = txt('tb-clock').split('//')[0].trim();
      return 'The time is ' + (t || 'unknown') + '.';
    }
    if (/\b(weather|temperature|temp|atmosphere)\b/.test(q)) {
      const t = txt('cc-temp'), c = txt('cc-cond'), hi = txt('cc-hi'), lo = txt('cc-lo');
      return `Currently ${t || '--'}, ${c || 'conditions unknown'} in Norman. High ${hi}, low ${lo}.`;
    }
    if (/\b(market|markets|stocks?|spy|qqq)\b/.test(q)) {
      const spy = txt('m-spy'), qqq = txt('m-qqq'), btc = txt('m-btc'), ten = txt('m-10y');
      return `S P Y ${spy || 'no data'}. Q Q Q ${qqq || 'no data'}. Bitcoin ${btc || 'no data'}. Ten-year ${ten || 'no data'}.`;
    }
    if (/\b(btc|bitcoin|crypto)\b/.test(q)) {
      return `Bitcoin is ${txt('gp-btc') || txt('m-btc') || 'unavailable'}.`;
    }
    if (/\b(rangers|mavericks|mavs|cowboys|sports)\b/.test(q)) {
      return `Rangers: ${txt('sp-rangers') || 'no game'}. Mavericks: ${txt('sp-mavs') || 'no game'}. Cowboys: ${txt('sp-cowboys') || 'no game'}.`;
    }
    if (/\b(system|cpu|ram|disk|host|clarix)\b/.test(q)) {
      return `Host: C P U ${txt('s-cpu')}, R A M ${txt('s-ram')}, disk ${txt('s-disk')}, network ${txt('s-net')}.`;
    }
    if (/\b(canvas|class(es)?|assignment|homework)\b/.test(q)) {
      clickTab('intel');
      return 'Pulling up Canvas in Intel.';
    }
    if (/\b(open|show|pull up)\b.*\b(intel)\b/.test(q)) { clickTab('intel');   return 'Opening intel.'; }
    if (/\b(open|show|pull up)\b.*\b(market|markets)\b/.test(q)) { clickTab('markets'); return 'Opening markets.'; }
    if (/\b(open|show|pull up)\b.*\b(life|email|spotify)\b/.test(q)) { clickTab('life');    return 'Opening life.'; }
    if (/\b(brief|morning brief)\b/.test(q)) { J.panels && J.panels.showBrief && J.panels.showBrief(); return 'Morning brief.'; }
    if (/\b(close|cancel|never mind|nevermind)\b/.test(q)) { return 'Standing by.'; }
    if (/\b(who are you|what are you)\b/.test(q)) return "I'm Jarvis. Your H U D presence.";

    return "I'm not wired into Open Claw yet, so I can't think about that one. Once the brain is linked, I'll be able to.";
  }

  function handle(text) { speak(router(text)); }

  /* ---- init / hotkeys ---- */
  function init() {
    const btn = J.$('voice-btn');
    if (btn) btn.addEventListener('click', () => (listening ? cancel() : listen()));

    // backtick (`) toggles listen anywhere outside text inputs
    window.addEventListener('keydown', (e) => {
      if (e.key !== '`') return;
      if (e.target && e.target.matches('input,textarea')) return;
      e.preventDefault();
      listening ? cancel() : listen();
    });

    // pre-warm voices for the fallback
    if (Synth) try { Synth.getVoices(); } catch (_) {}
    setMode('idle');
  }

  J.voice = { init, listen, speak, cancel };
})(window.JARVIS = window.JARVIS || {});
