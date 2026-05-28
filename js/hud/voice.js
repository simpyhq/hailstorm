/* voice.js — push-to-talk + wake word ("Jarvis") + premium TTS + brain stub.

   Mode state machine:
     'idle'      nothing happening
     'wake'      continuous recognition listening for "jarvis"
     'listen'    recognition actively capturing the next utterance (command)
     'process'   command captured; computing/fetching the reply
     'speak'     audio playing the reply

   Triggers
     VOX button click / orb click / backtick (`)   -> push-to-talk
     WAKE button click / Shift+backtick            -> toggle always-listening
     Wake mode persists across reloads via localStorage('jarvis_wake').

   The brain is a canned router on HUD data; commit 2 swaps it to OpenClaw via
   /api/chat. The TTS pipeline (commit 3) gains streaming via MediaSource. */
(function (J) {
  'use strict';

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const Synth = window.speechSynthesis;

  let mode = 'idle';
  let rec = null;
  let audio = null;
  let wakeEnabled = false;

  /* ---- mic / secure-context guards ----
     Voice input requires HTTPS or localhost. On file:// the browser silently
     denies the mic ('not-allowed') even when the permission prompt seems to
     appear. We detect this up front and surface a clear, actionable message
     instead of letting the page look broken. */
  const _host = location.hostname;
  const isLocalhost = _host === 'localhost' || _host === '127.0.0.1' || _host === '::1';
  const isHttps = location.protocol === 'https:';
  const isFile = location.protocol === 'file:';
  const canMic = !isFile && (isHttps || isLocalhost);

  function describeError(err) {
    switch (err) {
      case 'not-allowed':
      case 'service-not-allowed':
        return canMic
          ? 'Mic blocked. Click the lock icon in the address bar → set Microphone to Allow → refresh.'
          : 'Voice needs H T T P S. Open the deployed site (project-hailstorm.vercel.app), not the local file.';
      case 'audio-capture': return 'No microphone found on this device.';
      case 'network':       return 'Network blocked speech recognition.';
      case 'no-speech':     return null;   // normal silence
      case 'aborted':       return null;   // we caused it
      default:              return null;
    }
  }

  function preflight() {
    if (!SpeechRec) {
      showTranscript('Voice input requires Chrome, Edge, or Safari.', 'speaking');
      hideTranscript(5000);
      return false;
    }
    if (!canMic) {
      showTranscript('Voice needs H T T P S. Open the deployed site, not the local file.', 'speaking');
      hideTranscript(6000);
      return false;
    }
    return true;
  }

  /* if the user previously denied mic for this site, surface that proactively
     so they aren't left wondering why VOX does nothing */
  if (canMic && navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'microphone' }).then((status) => {
      if (status.state === 'denied') {
        // shown only when they actually try to use voice; checked again at click time
      }
      status.onchange = () => { /* state can change while page is open */ };
    }).catch(() => {});
  }

  /* ---- visual state plumbing ---- */
  function setMode(next) {
    mode = next;
    const cls = ['v-idle', 'v-wake', 'v-listen', 'v-process', 'v-speak'];
    document.body.classList.remove(...cls);
    document.body.classList.add('v-' + next);
    if (J.orb && J.orb.setState) {
      const map = { idle: 'idle', wake: 'idle', listen: 'listening', process: 'processing', speak: 'speaking' };
      J.orb.setState(map[next] || 'idle');
    }
  }
  function showTranscript(text, cls) {
    const el = J.$('voice-transcript'); if (!el) return;
    el.textContent = text;
    el.classList.remove('listening', 'speaking');
    if (cls) el.classList.add(cls);
    el.classList.add('show');
  }
  function hideTranscript(delay) {
    const el = J.$('voice-transcript'); if (!el) return;
    clearTimeout(hideTranscript._t);
    hideTranscript._t = setTimeout(() => el.classList.remove('show', 'listening', 'speaking'), delay || 0);
  }

  function makeRec(continuous) {
    if (!SpeechRec) return null;
    const r = new SpeechRec();
    r.continuous = !!continuous;
    r.interimResults = true;
    r.lang = 'en-US';
    return r;
  }

  /* ---- wake mode (continuous, listens for "jarvis") ---- */
  function startWake() {
    if (!wakeEnabled || mode === 'listen' || mode === 'process' || mode === 'speak') return;
    try { rec && rec.stop(); } catch (_) {}
    rec = makeRec(true);
    if (!rec) return;
    let pendingActive = false;     // set when "jarvis" was heard; onend hands off

    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = ((last && last[0] && last[0].transcript) || '').toLowerCase();
      if (/\bjarvis\b/.test(text)) {
        pendingActive = true;
        try { rec.stop(); } catch (_) {}     // wait for onend to start active listen
      }
    };
    rec.onerror = (e) => {
      const code = e && e.error;
      // hard failures: disable wake + tell the user what to do
      if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
        wakeEnabled = false;
        try { localStorage.setItem('jarvis_wake', '0'); } catch (_) {}
        document.body.classList.remove('wake-on');
        const btn = J.$('wake-btn'); if (btn) btn.classList.remove('active');
        setMode('idle');
        const msg = describeError(code);
        if (msg) { showTranscript(msg, 'speaking'); hideTranscript(7000); }
        return;
      }
      // transient (no-speech, network, aborted): back off and retry
      if (wakeEnabled && mode === 'wake') setTimeout(startWake, 1500);
    };
    rec.onend = () => {
      // 1) wake-word triggered: wait for full teardown, then start active listen
      if (pendingActive) { pendingActive = false; setTimeout(activeListen, 220); return; }
      // 2) browser ended continuous recognition on its own — restart if still on
      if (wakeEnabled && mode === 'wake') setTimeout(startWake, 400);
    };
    setMode('wake');
    try { rec.start(); } catch (_) {}
  }
  function resumeWake() {
    if (wakeEnabled && mode === 'idle') setTimeout(startWake, 250);
  }

  /* ---- active listen (one command) ---- */
  function activeListen() {
    if (mode === 'listen' || mode === 'process' || mode === 'speak') return;
    if (audio) { try { audio.pause(); } catch (_) {} }
    try { Synth && Synth.cancel(); } catch (_) {}
    try { rec && rec.stop(); } catch (_) {}
    rec = makeRec(false);
    if (!rec) { speak("Voice input isn't supported in this browser."); return; }
    rec.onresult = (e) => {
      const results = Array.from(e.results);
      const transcript = results.map((x) => x[0].transcript).join('').trim();
      const isFinal = results[results.length - 1].isFinal;
      showTranscript(transcript || '…', 'listening');
      if (isFinal) {
        setMode('process');
        handle(transcript);
      }
    };
    rec.onerror = (e) => {
      setMode('idle');
      const msg = describeError(e && e.error);
      if (msg) { showTranscript(msg, 'speaking'); hideTranscript(7000); }
      else hideTranscript(600);
      resumeWake();
    };
    rec.onend = () => {
      if (mode === 'listen') {
        setMode('idle');
        hideTranscript(500);
        resumeWake();
      }
    };
    setMode('listen');
    showTranscript('…', 'listening');
    try { rec.start(); } catch (_) {}
  }

  function listen() {
    if (!preflight()) return;
    activeListen();
  }

  function cancel() {
    try { rec && rec.stop(); } catch (_) {}
    try { audio && audio.pause(); } catch (_) {}
    try { Synth && Synth.cancel(); } catch (_) {}
    setMode('idle');
    hideTranscript(200);
    resumeWake();
  }

  /* ---- TTS ----
     Streaming path: pipe ElevenLabs's chunked MP3 through /api/tts and feed
     it into a MediaSource SourceBuffer ('audio/mpeg'). First audio plays
     sub-second. Falls back to blob playback when MSE/MP3 isn't supported
     (Safari), and ultimately to browser speechSynthesis when /api/tts can't
     reach a provider (no key, file://, etc.). */
  async function speak(text) {
    if (!text) { resumeWake(); return; }
    setMode('speak');
    showTranscript('› ' + text, 'speaking');

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const canStream = 'MediaSource' in window
          && MediaSource.isTypeSupported('audio/mpeg')
          && res.body && typeof res.body.getReader === 'function';
        if (canStream) { await playStream(res); return; }
        const blob = await res.blob();
        await playBlob(blob);
        return;
      }
    } catch (_) { /* fall through */ }
    speakFallback(text);
  }

  function playBlob(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setMode('idle'); hideTranscript(400); resumeWake(); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); setMode('idle'); hideTranscript(400); resumeWake(); resolve(); };
      audio.play().catch(() => { URL.revokeObjectURL(url); setMode('idle'); hideTranscript(400); resumeWake(); resolve(); });
    });
  }

  function playStream(res) {
    return new Promise((resolve) => {
      const ms = new MediaSource();
      const url = URL.createObjectURL(ms);
      audio = new Audio(url);
      audio.preload = 'auto';
      let resolved = false;
      const finish = () => { if (resolved) return; resolved = true; URL.revokeObjectURL(url); resolve(); };
      audio.onended = () => { setMode('idle'); hideTranscript(400); resumeWake(); finish(); };
      audio.onerror = () => { setMode('idle'); hideTranscript(400); resumeWake(); finish(); };

      ms.addEventListener('sourceopen', async () => {
        let sb;
        try { sb = ms.addSourceBuffer('audio/mpeg'); }
        catch (_) { finish(); return; }

        const reader = res.body.getReader();
        const queue = [];
        let started = false;

        const drain = () => {
          if (sb.updating || queue.length === 0) return;
          try { sb.appendBuffer(queue.shift()); } catch (_) { /* ignore */ }
        };
        const maybePlay = () => {
          if (!started && audio.readyState >= 2) {
            started = true;
            audio.play().catch(() => {});
          }
        };
        sb.addEventListener('updateend', () => { drain(); maybePlay(); });

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            queue.push(value); drain(); maybePlay();
          }
          // wait for tail chunks to flush, then close the stream
          await new Promise((r) => {
            const check = () => (queue.length === 0 && !sb.updating) ? r() : setTimeout(check, 30);
            check();
          });
          if (ms.readyState === 'open') { try { ms.endOfStream(); } catch (_) {} }
        } catch (_) { finish(); }
      }, { once: true });
    });
  }

  function speakFallback(text) {
    if (!Synth) { setMode('idle'); hideTranscript(400); resumeWake(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02; u.pitch = 0.85; u.volume = 1;
    const voices = Synth.getVoices();
    const pref = voices.find((v) => /Daniel|Alex|Google UK English Male|Microsoft (David|Mark)/i.test(v.name))
              || voices.find((v) => /male/i.test(v.name))
              || voices[0];
    if (pref) u.voice = pref;
    u.onend = () => { setMode('idle'); hideTranscript(400); resumeWake(); };
    Synth.cancel();
    Synth.speak(u);
  }

  /* ---- canned brain (swap to OpenClaw in commit 2) ---- */
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
    if (/\b(btc|bitcoin|crypto)\b/.test(q)) return `Bitcoin is ${txt('gp-btc') || txt('m-btc') || 'unavailable'}.`;
    if (/\b(rangers|mavericks|mavs|cowboys|sports)\b/.test(q)) {
      return `Rangers: ${txt('sp-rangers') || 'no game'}. Mavericks: ${txt('sp-mavs') || 'no game'}. Cowboys: ${txt('sp-cowboys') || 'no game'}.`;
    }
    if (/\b(system|cpu|ram|disk|host|clarix)\b/.test(q)) {
      return `Host: C P U ${txt('s-cpu')}, R A M ${txt('s-ram')}, disk ${txt('s-disk')}, network ${txt('s-net')}.`;
    }
    if (/\b(canvas|class(es)?|assignment|homework)\b/.test(q)) { clickTab('intel'); return 'Pulling up Canvas in Intel.'; }
    if (/\b(open|show|pull up)\b.*\b(intel)\b/.test(q)) { clickTab('intel'); return 'Opening intel.'; }
    if (/\b(open|show|pull up)\b.*\b(market|markets)\b/.test(q)) { clickTab('markets'); return 'Opening markets.'; }
    if (/\b(open|show|pull up)\b.*\b(life|email|spotify)\b/.test(q)) { clickTab('life'); return 'Opening life.'; }
    if (/\b(brief|morning brief)\b/.test(q)) { J.panels && J.panels.showBrief && J.panels.showBrief(); return 'Morning brief.'; }
    if (/\b(close|cancel|never mind|nevermind)\b/.test(q)) { return 'Standing by.'; }
    if (/\b(who are you|what are you)\b/.test(q)) return "I'm Jarvis. Your H U D presence.";
    return null;  // unknown locally — defer to the OpenClaw brain (if configured)
  }

  /* persistent session id so the brain can keep multi-turn context */
  let _session = null;
  function getSession() {
    if (_session) return _session;
    try { _session = localStorage.getItem('jarvis_session'); } catch (_) {}
    if (!_session) {
      _session = (crypto && crypto.randomUUID && crypto.randomUUID())
        || ('s_' + Math.random().toString(36).slice(2) + Date.now().toString(36));
      try { localStorage.setItem('jarvis_session', _session); } catch (_) {}
    }
    return _session;
  }

  async function askBrain(text) {
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: getSession() }),
      });
      if (!r.ok) return null;       // 503 = no brain configured -> use fallback
      const data = await r.json();
      return (data && data.reply) ? data.reply : null;
    } catch (_) { return null; }
  }

  async function handle(text) {
    // 1) HUD commands + on-screen data answer locally for instant responses
    const local = router(text);
    if (local) { speak(local); return; }
    // 2) otherwise ask the brain (OpenClaw via /api/chat)
    const remote = await askBrain(text);
    if (remote) { speak(remote); return; }
    // 3) last-resort fallback
    speak("I'm not wired into Open Claw yet. Set the brain U R L in Vercel and I'll be online.");
  }

  /* ---- WAKE toggle ---- */
  function setWake(on) {
    if (on && !preflight()) {
      // user asked for wake but the environment can't deliver it — don't persist on
      document.body.classList.remove('wake-on');
      const btn = J.$('wake-btn'); if (btn) btn.classList.remove('active');
      try { localStorage.setItem('jarvis_wake', '0'); } catch (_) {}
      return;
    }
    wakeEnabled = !!on;
    try { localStorage.setItem('jarvis_wake', wakeEnabled ? '1' : '0'); } catch (_) {}
    document.body.classList.toggle('wake-on', wakeEnabled);
    const btn = J.$('wake-btn'); if (btn) btn.classList.toggle('active', wakeEnabled);
    if (wakeEnabled) startWake();
    else if (mode === 'wake') { try { rec && rec.stop(); } catch (_) {} setMode('idle'); }
  }
  function toggleWake() { setWake(!wakeEnabled); }

  /* ---- init / hotkeys / orb-click PTT ---- */
  function init() {
    const voxBtn = J.$('voice-btn');
    if (voxBtn) voxBtn.addEventListener('click', () => {
      if (mode === 'listen' || mode === 'process') cancel(); else listen();
    });

    const wakeBtn = J.$('wake-btn');
    if (wakeBtn) wakeBtn.addEventListener('click', toggleWake);

    // Click the orb itself to push-to-talk — the AI presence affordance
    const orbCanvas = J.$('orb-canvas');
    if (orbCanvas) orbCanvas.addEventListener('click', () => {
      if (mode === 'listen' || mode === 'process') cancel(); else listen();
    });

    // backtick = PTT; Shift+backtick = toggle wake mode
    window.addEventListener('keydown', (e) => {
      if (e.key !== '`') return;
      if (e.target && e.target.matches('input,textarea')) return;
      e.preventDefault();
      if (e.shiftKey) { toggleWake(); return; }
      if (mode === 'listen') cancel(); else listen();
    });

    if (Synth) try { Synth.getVoices(); } catch (_) {}
    setMode('idle');

    // restore persisted wake-mode state
    try {
      if (localStorage.getItem('jarvis_wake') === '1') {
        setTimeout(() => setWake(true), 500);
      }
    } catch (_) {}
  }

  J.voice = { init, listen, speak, cancel, setWake, toggleWake };
})(window.JARVIS = window.JARVIS || {});
