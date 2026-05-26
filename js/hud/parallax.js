/* parallax.js — rAF + lerp 3D parallax engine.
   Mouse position is smoothed (never wired straight to transforms); each layer
   tilts/translates by its own depth. Per-element perspective() keeps the
   depth real (not skew). Disabled for reduced-motion and non-fine pointers. */
(function (J) {
  'use strict';

  const MAX = 1.0;            // normalized cursor extent
  const EASE = 0.08;          // lerp factor toward target
  const layers = [];          // { el, base, tilt, lift, persp, far }

  let tx = 0, ty = 0;         // target  (-1..1 from screen center)
  let cx = 0, cy = 0;         // current (lerped)
  let running = false;
  let registered = false;

  function add(sel, opt) {
    document.querySelectorAll(sel).forEach((el) => {
      layers.push({
        el,
        base: opt.base || '',
        tilt: opt.tilt || 0,    // max degrees of rotateX/Y
        lift: opt.lift || 0,    // max px of translate
        persp: opt.persp || 0,  // perspective() px (0 = none)
        far: !!opt.far,         // background layers move opposite the cursor
      });
    });
  }

  function register() {
    if (registered) return;
    registered = true;
    add('#orb-wrap', { base: 'translate(-50%,-50%)', tilt: 8, lift: 6, persp: 1100 });
    add('.cc',       { tilt: 5, lift: 10, persp: 900 });
    add('.bc',       { tilt: 4, lift: 14, persp: 900 });
    add('.gp-tilt',  { tilt: 5, lift: 0,  persp: 1000 });
    add('.hex-grid', { tilt: 0, lift: 12, far: true });
  }

  function apply() {
    cx += (tx - cx) * EASE;
    cy += (ty - cy) * EASE;

    for (const L of layers) {
      const dir = L.far ? -1 : 1;
      const ry = (L.tilt * cx * dir);          // horizontal -> rotateY
      const rx = (-L.tilt * cy * dir);         // vertical   -> rotateX
      const txp = (L.lift * cx * dir);
      const typ = (L.lift * cy * dir);
      const persp = L.persp ? `perspective(${L.persp}px) ` : '';
      L.el.style.transform =
        `${L.base} ${persp}translate3d(${txp.toFixed(2)}px, ${typ.toFixed(2)}px, 0) ` +
        `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    }

    if (Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005) {
      requestAnimationFrame(apply);
    } else {
      running = false;
    }
  }

  function kick() { if (!running) { running = true; requestAnimationFrame(apply); } }

  function onMove(e) {
    tx = Math.max(-MAX, Math.min(MAX, (e.clientX / window.innerWidth - 0.5) * 2));
    ty = Math.max(-MAX, Math.min(MAX, (e.clientY / window.innerHeight - 0.5) * 2));
    kick();
  }
  function recenter() { tx = 0; ty = 0; kick(); }

  function init() {
    const fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
    if (J.reducedMotion || !fine) return;   // accessibility / touch: stay flat
    register();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', recenter);
    window.addEventListener('blur', recenter);
    kick();
  }

  J.parallax = { init, register };
})(window.JARVIS = window.JARVIS || {});
