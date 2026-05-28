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
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = ((last && last[0] && last[0].transcript) || '').toLowerCase();
      if (/\bjarvis\b/.test(text)) {
        try { rec.stop(); } catch (_) {}
        // small gap so the wake word itself isn't captured as the command
        setTimeout(() => { if (mode !== 'speak') activeListen(); }, 140);
      }
    };
    rec.onerror = (e) => {
      if (e && e.error === 'not-allowed') {
        wakeEnabled = false;
        try { localStorage.setItem('jarvis_wake', '0'); } catch (_) {}
        document.body.classList.remove('wake-on');
        const btn = J.$('wake-btn'); if (btn) btn.classList.remove('active');
        setMode('idle');
        showTranscript('Mic blocked. Allow microphone in the address bar.', 'speaking');
        hideTranscript(4500);
        return;
      }
      if (wakeEnabled && mode === 'wake') setTimeout(startWake, 1200);
    };
    rec.onend = () => {
      // browsers end continuous mode periodically — restart while wake is on
      if (wakeEnabled && mode === 'wake') setTimeout(startWake, 250);
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
      if (e && e.error === 'not-allowed') {
        showTranscript('Mic blocked. Allow microphone in the address bar.', 'speaking');
        hideTranscript(4500);
      } else hideTranscript(600);
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

  function listen() { activeListen(); }

  function cancel() {
    try { rec && rec.stop(); } catch (_) {}
    try { audio && audio.pause(); } catch (_) {}
    try { Synth && Synth.cancel(); } catch (_) {}
    setMode('idle');
    hideTranscript(200);
    resumeWake();
  }

  /* ---- TTS (premium /api/tts -> browser speechSynthesis fallback) ---- */
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
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); setMode('idle'); hideTranscript(400); resumeWake(); };
        audio.onerror = () => { URL.revokeObjectURL(url); speakFallback(text); };
        await audio.play();
        return;
      }
    } catch (_) { /* fall through */ }

    speakFallback(text);
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
    return "I'm not wired into Open Claw yet, so I can't think about that one. Once the brain is linked, I'll be able to.";
  }
  function handle(text) { speak(router(text)); }

  /* ---- WAKE toggle ---- */
  function setWake(on) {
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
