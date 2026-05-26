/* core.js — shared namespace, DOM helpers, event bus, state.
   Loaded first; everything else hangs off window.JARVIS (alias J). */
(function (J) {
  'use strict';

  J.$ = (id) => document.getElementById(id);
  J.setTxt = (id, v) => { const e = J.$(id); if (e) e.textContent = v; };
  J.setHtml = (id, v) => { const e = J.$(id); if (e) e.innerHTML = v; };
  J.setWidth = (id, v) => { const e = J.$(id); if (e) e.style.width = v + '%'; };

  // shared runtime state
  J.state = { orbState: 'idle' };

  // minimal pub/sub for cross-module signals
  const listeners = {};
  J.bus = {
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    emit(evt, data) { (listeners[evt] || []).forEach((fn) => fn(data)); },
  };

  J.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
})(window.JARVIS = window.JARVIS || {});
